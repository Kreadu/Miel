"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { writeActiveTenantCookie } from "@/lib/tenant/cookie";

const tenantIdSchema = z.uuid();

/**
 * Fija el tenant activo elegido por el usuario. La cookie es solo una preferencia:
 * `getActiveTenant()` la vuelve a validar contra `memberships` en cada lectura
 * (docs/arch/multitenancy-rls.md, regla 3) — aquí solo se confirma pertenencia antes de
 * guardarla, para no dejar una cookie apuntando a un tenant ajeno.
 */
export async function setActiveTenant(formData: FormData): Promise<void> {
  const parsed = tenantIdSchema.safeParse(formData.get("tenantId"));
  if (!parsed.success) return;

  const supabase = await createClient();
  const { count } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", parsed.data);
  if (!count) return;

  await writeActiveTenantCookie(parsed.data);
  revalidatePath("/", "layout");
}
