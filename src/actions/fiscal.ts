"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { fiscalSettingsSchema } from "@/lib/validation/fiscal";

export type FiscalState = { ok: true } | { ok: false; error: string } | null;

/** S23-01: owner/admin guardan el tipo de persona y la tarifa de renta (RLS tenants_admin_update). */
export async function saveFiscalSettings(_prev: FiscalState, formData: FormData): Promise<FiscalState> {
  const parsed = fiscalSettingsSchema.safeParse({
    person_type: formData.get("person_type"),
    income_tax_rate: formData.get("income_tax_rate"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active || active.role === "member") return { ok: false, error: "No tienes permiso para esta operación." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({ person_type: parsed.data.person_type, income_tax_rate: parsed.data.income_tax_rate })
    .eq("id", active.tenantId);
  if (error) {
    console.error("saveFiscalSettings:", error.code);
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  }
  revalidatePath("/resultados");
  return { ok: true };
}
