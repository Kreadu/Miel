import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

import { resolveActiveTenant, type ActiveMembership } from "./active-tenant";
import { ACTIVE_TENANT_COOKIE } from "./cookie";

/**
 * Único punto de lectura del tenant activo (docs/arch/multitenancy-rls.md, regla 3):
 * resuelve en servidor contra `memberships` — la cookie es dato no confiable, nunca la
 * fuente de la decisión.
 */
export async function getActiveTenant(): Promise<{
  active: ActiveMembership | null;
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
    .select("tenant_id, role, tenants(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error("No se pudieron cargar las empresas del usuario.");

  const memberships: ActiveMembership[] = (data ?? []).map((m) => ({
    tenantId: m.tenant_id,
    role: m.role as ActiveMembership["role"],
    tenantName: m.tenants?.name ?? "",
  }));

  const cookieTenantId = (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value;
  return { active: resolveActiveTenant(memberships, cookieTenantId), memberships };
}
