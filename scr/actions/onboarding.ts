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
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_tenant_with_owner", {
    p_name: parsed.data.name,
    p_nit: parsed.data.nit,
  });
  if (error) {
    console.error("createTenant:", error.code);
    // P0001 = regla de negocio de la RPC (p. ej. límite de un owner, ADR-026): mensaje apto
    // para el usuario, sin internos. El resto queda genérico.
    return {
      ok: false,
      error:
        error.code === "P0001"
          ? error.message
          : "No se pudo crear la empresa. Intenta de nuevo.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/inicio");
}
