"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { posSchema } from "@/lib/validation/pos";

export type PosState = { ok: false; error: string } | { ok: true; sale_id: string } | null;

const POS_PATH = "/ventas/pos";

export async function registerPosSale(
  _prev: PosState,
  formData: FormData,
): Promise<PosState> {
  const itemsRaw = formData.get("items")?.toString();
  const rawTotal = formData.get("total")?.toString() || "0";
  let rawItems: unknown;
  try {
    rawItems = itemsRaw ? JSON.parse(itemsRaw) : [];
  } catch {
    return { ok: false, error: "Los ítems de la venta no son válidos." };
  }

  // "Mostrador" viaja como el sentinel __counter__ (Radix no admite value=""): se normaliza a
  // ausente para que la venta quede sin cliente.
  const rawCustomer = formData.get("customer_id")?.toString();
  const customerId = rawCustomer === "__counter__" ? undefined : rawCustomer || undefined;

  const parsed = posSchema.safeParse({
    warehouse_id: formData.get("warehouse_id"),
    customer_id: customerId,
    payment_method: formData.get("payment_method"),
    note: formData.get("note") || undefined,
    items: rawItems,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { active } = await getActiveTenant();
  if (!active) {
    return { ok: false, error: "Selecciona una empresa primero." };
  }

  const data = parsed.data;
  const amount = Number(rawTotal);

  if (amount <= 0) {
    return { ok: false, error: "El total de la venta debe ser mayor a 0." };
  }

  const payments = [{ method: data.payment_method, amount }];

  const supabase = await createClient();

  const { data: saleId, error } = await supabase.rpc("register_pos_sale", {
    p_tenant_id: active.tenantId,
    p_warehouse_id: data.warehouse_id,
    p_items: data.items,
    p_payments: payments,
    p_customer_id: data.customer_id || undefined,
    p_note: data.note || undefined,
  });

  if (error) {
    return { ok: false, error: mapPosError(error.message) };
  }

  revalidatePath(POS_PATH);
  revalidatePath("/ventas/pedidos");
  revalidatePath("/ventas/caja");

  return { ok: true, sale_id: saleId };
}

function mapPosError(message?: string): string {
  if (!message) return "Ocurrió un error inesperado al registrar la venta.";
  if (message.includes("pos_no_open_session")) return "No tienes un turno de caja abierto.";
  if (message.includes("pos_payment_mismatch")) return "El total de los pagos no coincide con el total de la venta.";
  if (message.includes("stock_insufficient")) return "No hay stock suficiente para uno o más productos.";
  if (message.includes("warehouse_invalid")) return "La bodega seleccionada no es válida.";
  if (message.includes("item_discount_invalid")) return "El descuento de un ítem no puede superar el precio de la línea.";
  if (message.includes("product_invalid")) return "Uno o más productos no son válidos o están inactivos.";
  if (message.includes("permission_denied")) return "No tienes permisos para realizar esta operación.";
  if (message.includes("pos_payment_invalid")) return "El método o monto de pago no es válido.";
  return "Ocurrió un error inesperado al registrar la venta.";
}
