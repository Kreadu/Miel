"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { interactionSchema } from "@/lib/validation/interactions";

export type InteractionState = { ok: false; error: string } | { ok: true } | null;

/** Cualquier rol del tenant activo registra interacciones (RLS lo garantiza). Append-only. */
export async function createInteraction(
  _prev: InteractionState,
  formData: FormData,
): Promise<InteractionState> {
  const parsed = interactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();

  // Defensa en profundidad: no confiar solo en que el select del formulario ya filtró
  // el cliente por tenant activo.
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", parsed.data.customer_id)
    .eq("tenant_id", active.tenantId)
    .maybeSingle();
  if (!customer) return { ok: false, error: "Cliente inválido." };

  const { error } = await supabase.from("customer_interactions").insert({
    tenant_id: active.tenantId,
    customer_id: parsed.data.customer_id,
    kind: parsed.data.kind,
    note: parsed.data.note,
    ...(parsed.data.occurred_at ? { occurred_at: new Date(parsed.data.occurred_at).toISOString() } : {}),
  });

  if (error) {
    console.error("createInteraction:", error.code);
    return { ok: false, error: "No se pudo registrar la interacción. Intenta de nuevo." };
  }

  revalidatePath(`/ventas/clientes/${parsed.data.customer_id}`);
  return { ok: true };
}
