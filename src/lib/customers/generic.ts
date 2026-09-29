import type { createClient } from "@/lib/supabase/server";

/**
 * S19-09: cuando una venta (Pedidos o POS) no elige un cliente puntual, se asocia al cliente
 * genérico del tenant en vez de dejar `customer_id = null` — así "Registrar cobro" (que exige
 * `customer_id` no nulo, `SaleRow.isReceivable`) también funciona para ventas de mostrador.
 * Como máximo uno por tenant (índice único parcial `customers_one_generic_per_tenant`).
 */
export async function getOrCreateGenericCustomerId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_generic", true)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("customers")
    .insert({ tenant_id: tenantId, name: "Cliente genérico", is_generic: true })
    .select("id")
    .single();

  if (error) {
    // Carrera: dos ventas simultáneas sin cliente elegido pueden intentar crearlo a la vez —
    // el índice único parcial rechaza la segunda (23505); en vez de fallar la venta, se relee.
    if (error.code === "23505") {
      const { data: retry } = await supabase
        .from("customers")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("is_generic", true)
        .maybeSingle();
      return retry?.id ?? null;
    }
    console.error("getOrCreateGenericCustomerId:", error.code);
    return null;
  }

  return created?.id ?? null;
}
