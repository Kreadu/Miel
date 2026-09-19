"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { saleSchema } from "@/lib/validation/sales";

export type SaleState = { ok: false; error: string } | { ok: true } | null;

const SALES_PATH = "/ventas/pedidos";

// El <Select> nativo no admite value="" para una opción (Radix la reserva para "sin selección"),
// así que "Mostrador / sin cliente" usa este sentinel en el formulario; aquí se normaliza a
// ausente antes de validar/enviar a la RPC (customer_id null = venta de mostrador).
const NO_CUSTOMER_SENTINEL = "__counter__";

function mapSaleError(message: string | undefined): string {
  if (message?.includes("customer_invalid")) return "Selecciona un cliente válido y activo.";
  if (message?.includes("product_invalid")) return "Uno de los productos no es válido o está inactivo.";
  if (message?.includes("permission_denied")) return "No tienes permiso para esta operación.";
  if (message?.includes("items_required")) return "Agrega al menos un ítem a la venta.";
  if (message?.includes("item_qty_invalid")) return "La cantidad de un ítem debe ser mayor a cero.";
  if (message?.includes("item_unit_price_invalid")) return "El precio de un ítem no puede ser negativo.";
  if (message?.includes("item_discount_invalid")) return "El descuento de un ítem no puede superar el precio de la línea.";
  return "No se pudo guardar la venta. Intenta de nuevo.";
}

/** Cualquier miembro del tenant activo crea ventas (create_sale lo valida igual: pertenencia, no rol admin). */
export async function createSale(_prev: SaleState, formData: FormData): Promise<SaleState> {
  const raw = Object.fromEntries(formData);
  if (raw.customer_id === NO_CUSTOMER_SENTINEL) raw.customer_id = "";
  const itemsRaw = typeof raw.items === "string" ? raw.items : "[]";
  let items: unknown;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { ok: false, error: "Los ítems de la venta no son válidos." };
  }

  const parsed = saleSchema.safeParse({ ...raw, items });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No tienes una empresa activa." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_sale", {
    p_tenant_id: active.tenantId,
    p_items: parsed.data.items,
    p_customer_id: parsed.data.customer_id || undefined,
    p_note: parsed.data.note || undefined,
  });

  if (error) {
    console.error("createSale:", error.code, error.message);
    return { ok: false, error: mapSaleError(error.message) };
  }

  revalidatePath(SALES_PATH);
  return { ok: true };
}

export async function confirmSale(saleId: string, warehouseId: string): Promise<SaleState> {
  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No tienes una empresa activa." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_sale", {
    p_sale_id: saleId,
    p_warehouse_id: warehouseId,
  });

  if (error) {
    console.error("confirmSale:", error.code, error.message);
    if (error.message.includes("not_authenticated")) return { ok: false, error: "No estás autenticado." };
    if (error.message.includes("permission_denied")) return { ok: false, error: "No tienes permiso para confirmar esta venta." };
    if (error.message.includes("warehouse_invalid")) return { ok: false, error: "La bodega seleccionada es inválida." };
    if (error.message.includes("sale_not_draft")) return { ok: false, error: "La venta ya no está en borrador." };
    if (error.message.includes("stock_insufficient")) return { ok: false, error: "No hay stock suficiente para confirmar esta venta." };
    return { ok: false, error: "No se pudo confirmar la venta. Intenta de nuevo." };
  }

  revalidatePath(SALES_PATH);
  return { ok: true };
}

export async function markSaleShipped(saleId: string, shippingAddress: string): Promise<SaleState> {
  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No tienes una empresa activa." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_sale_shipped", {
    p_sale_id: saleId,
    p_shipping_address: shippingAddress,
  });

  if (error) {
    console.error("markSaleShipped:", error.code, error.message);
    if (error.message.includes("not_authenticated")) return { ok: false, error: "No estás autenticado." };
    if (error.message.includes("shipping_address_required")) return { ok: false, error: "La dirección de envío es obligatoria." };
    if (error.message.includes("sale_not_confirmed_or_not_found")) return { ok: false, error: "La venta no está confirmada o no existe." };
    return { ok: false, error: "No se pudo despachar la venta. Intenta de nuevo." };
  }

  revalidatePath(SALES_PATH);
  return { ok: true };
}

export async function markSaleDelivered(saleId: string): Promise<SaleState> {
  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No tienes una empresa activa." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_sale_delivered", {
    p_sale_id: saleId,
  });

  if (error) {
    console.error("markSaleDelivered:", error.code, error.message);
    if (error.message.includes("not_authenticated")) return { ok: false, error: "No estás autenticado." };
    if (error.message.includes("sale_not_confirmed_or_shipped")) return { ok: false, error: "La venta no ha sido despachada ni confirmada." };
    return { ok: false, error: "No se pudo entregar la venta. Intenta de nuevo." };
  }

  revalidatePath(SALES_PATH);
  return { ok: true };
}
