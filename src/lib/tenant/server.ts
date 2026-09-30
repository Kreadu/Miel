import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import { type Access, resolveAccess } from "./access";
import { resolveActiveTenant, type ActiveMembership, type Role } from "./active-tenant";
import { ACTIVE_TENANT_COOKIE } from "./cookie";
import { STORE_COOKIE, verifyStoreSession } from "./store-session";

/** Tenant activo + lo que el usuario ve en él (S21-03). `role` es el rol efectivo. */
export type ActiveTenant = ActiveMembership & Access & { accountRole: Role };

/**
 * Único punto de lectura del tenant activo (docs/arch/multitenancy-rls.md, regla 3):
 * resuelve en servidor contra `memberships` — la cookie es dato no confiable, nunca la
 * fuente de la decisión.
 */
export const getActiveTenant = cache(async function getActiveTenant(): Promise<{
  active: ActiveTenant | null;
  memberships: ActiveMembership[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { active: null, memberships: [] };

  // RLS de `memberships` es visible a todo el equipo del tenant (lo necesita /equipo para
  // listar compañeros — S1-05), NO solo a la fila propia. Por eso el filtro `user_id` es
  // explícito aquí (nextjs-miel: "el filtro explícito solo cuando la semántica lo requiera"):
  // sin él, un tenant con ≥2 miembros devuelve una fila por compañero y el primero por
  // `created_at` (casi siempre el owner) pisa el rol real del usuario actual.
  const { data, error } = await supabase
    .from("memberships")
    .select("tenant_id, role, worker_categories(modules), tenants(name, sells_physical, sells_virtual, currency)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error("No se pudieron cargar las empresas del usuario.");

  const memberships: ActiveMembership[] = (data ?? []).map((m) => ({
    tenantId: m.tenant_id,
    role: m.role as ActiveMembership["role"],
    tenantName: m.tenants?.name ?? "",
    sellsPhysical: m.tenants?.sells_physical ?? true,
    sellsVirtual: m.tenants?.sells_virtual ?? false,
    currency: m.tenants?.currency ?? "COP",
    categoryModules: m.worker_categories?.modules ?? null,
  }));

  const cookieStore = await cookies();
  const membership = resolveActiveTenant(memberships, cookieStore.get(ACTIVE_TENANT_COOKIE)?.value);
  if (!membership) return { active: null, memberships };

  // S21-03: modo tienda (cookie firmada) solo si es de esta cuenta y esta empresa. Los permisos
  // del trabajador se releen de la BD en cada request (un retiro o cambio de categoría aplica ya).
  const store = verifyStoreSession(
    cookieStore.get(STORE_COOKIE)?.value,
    process.env.MIEL_SESSION_SECRET ?? "",
    Date.now(),
  );
  let storeAccess: Parameters<typeof resolveAccess>[2] = null;
  if (store && store.userId === user.id && store.tenantId === membership.tenantId) {
    let worker = null;
    if (store.workerId) {
      const { data: rows } = await supabase.rpc("active_worker_modules", {
        p_tenant_id: membership.tenantId,
        p_worker_id: store.workerId,
      });
      const row = rows?.[0];
      if (row) worker = { id: store.workerId, name: row.full_name, modules: row.modules };
    }
    storeAccess = { worker };
  }

  const access = resolveAccess(membership.role, membership.categoryModules, storeAccess);
  return {
    active: { ...membership, ...access, accountRole: membership.role },
    memberships,
  };
});

/**
 * S21-03: protección de un módulo (layout de /ventas, /inventario, …). En modo tienda sin
 * trabajador identificado pide el código; fuera de la categoría responde "no encontrado".
 */
export async function requireModule(moduleId: string): Promise<void> {
  const { active } = await getActiveTenant();
  if (!active) return;
  if (active.needsWorker) redirect("/trabajador");
  if (active.modules !== null && !active.modules.includes(moduleId)) notFound();
}
