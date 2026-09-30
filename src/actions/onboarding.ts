"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { onboardingSchema } from "@/lib/validation/onboarding";

export type OnboardingState = { ok: false; error: string } | null;

export async function createTenant(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = onboardingSchema.safeParse({
    name: formData.get("name"),
    nit: formData.get("nit") || undefined,
    sellsPhysical: formData.get("sellsPhysical") === "on",
    sellsVirtual: formData.get("sellsVirtual") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_tenant_with_owner", {
    p_name: parsed.data.name,
    p_nit: parsed.data.nit,
    p_sells_physical: parsed.data.sellsPhysical,
    p_sells_virtual: parsed.data.sellsVirtual,
  });
  if (error) {
    console.error("createTenant:", error.code);
    // P0001 = regla de negocio de la RPC (ADR-031): se traduce a una clave (E20). El resto, genérico.
    const rule = error.code === "P0001" ? error.message : "";
    return {
      ok: false,
      error: rule.includes("Ya perteneces")
        ? "onboarding.errors.alreadyMember"
        : rule.includes("canal")
          ? "onboarding.errors.channelRequired"
          : rule.includes("nombre")
            ? "onboarding.errors.nameRequired"
            : "onboarding.errors.failed",
    };
  }

  revalidatePath("/", "layout");
  redirect("/inicio");
}
