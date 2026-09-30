import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

export type ActivityAction =
  | "sale_created"
  | "sale_confirmed"
  | "sale_cancelled"
  | "payment_registered"
  | "cash_opened"
  | "cash_closed"
  | "purchase_received"
  | "stock_adjusted"
  | "sale_refunded";

/**
 * S21-04: deja constancia de una acción importante y de quién la hizo (en el modo tienda, el
 * trabajador identificado con su código). Nunca lanza: si el registro falla, la operación ya
 * hecha no se deshace ni se reporta como error.
 */
export async function logActivity(
  action: ActivityAction,
  { entityId, detail }: { entityId?: string; detail?: string } = {},
): Promise<void> {
  try {
    const { active } = await getActiveTenant();
    if (!active) return;
    const supabase = await createClient();
    const { error } = await supabase.from("activity_log").insert({
      tenant_id: active.tenantId,
      worker_id: active.worker?.id ?? null,
      action,
      entity_id: entityId ?? null,
      detail: detail ?? null,
    });
    if (error) console.error("logActivity:", error.code);
  } catch (e) {
    console.error("logActivity:", e);
  }
}
