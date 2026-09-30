"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logActivity } from "@/lib/activity/log";
import { getOrCreateGenericCustomerId } from "@/lib/customers/generic";
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
  if (message?.includes("customer_invalid")) return "sales.errors.customerInvalid";
  if (message?.includes("product_invalid")) return "sales.errors.productInvalid";
  if (message?.includes("permission_denied")) return "common.errors.permissionDenied";
  if (message?.includes("items_required")) return "sales.errors.itemsRequired";
  if (message?.includes("item_qty_invalid")) return "sales.errors.qtyPositive";
  if (message?.includes("payment_method_invalid")) return "sales.errors.paymentMethodInvalid";
  if (message?.includes("delivery_method_invalid")) return "sales.errors.deliveryMethodInvalid";
  if (message?.includes("shipping_rate_invalid")) return "sales.errors.shippingRateInvalid";
  if (message?.includes("shipping_km_invalid")) return "sales.errors.kmRequired";
  if (message?.includes("shipping_cost_invalid")) return "sales.errors.shippingCostInvalid";
  return "sales.errors.saveFailed";
}

/** Cualquier miembro del tenant activo crea ventas (create_sale lo valida igual: pertenencia, no rol admin). */
export async function createSale(_prev: SaleState, formData: FormData): Promise<SaleState> {
  const raw: Record<string, FormDataEntryValue | undefined> = Object.fromEntries(formData);
  if (raw.customer_id === NO_CUSTOMER_SENTINEL) raw.customer_id = "";
  // S19-35: un número vacío del form es "no vino" (z.coerce convertiría "" en 0).
  for (const key of ["shipping_km", "shipping_cost"]) if (raw[key] === "") raw[key] = undefined;
  const itemsRaw = typeof raw.items === "string" ? raw.items : "[]";
  let items: unknown;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { ok: false, error: "sales.errors.itemsInvalid" };
  }

  const parsed = saleSchema.safeParse({ ...raw, items });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const supabase = await createClient();

  // S19-09: sin cliente elegido, se asocia al cliente genérico del tenant (no customer_id
  // null) — así "Registrar cobro" también funciona para ventas de mostrador.
  const customerId =
    parsed.data.customer_id || (await getOrCreateGenericCustomerId(supabase, active.tenantId));

  const { data: saleId, error } = await supabase.rpc("create_sale", {
    p_tenant_id: active.tenantId,
    p_items: parsed.data.items,
    p_customer_id: customerId || undefined,
    p_note: parsed.data.note || undefined,
    p_payment_method: parsed.data.payment_method || undefined,
    p_delivery_method: parsed.data.delivery_method || undefined,
    p_shipping_rate_id: parsed.data.shipping_rate_id || undefined,
    p_shipping_km: parsed.data.shipping_km,
    p_shipping_cost: parsed.data.delivery_method === "agreed" ? parsed.data.shipping_cost : undefined,
  });

  if (error) {
    console.error("createSale:", error.code, error.message);
    return { ok: false, error: mapSaleError(error.message) };
  }

  await logActivity("sale_created", { entityId: saleId ?? undefined });
  revalidatePath(SALES_PATH);
  return { ok: true };
}

export async function confirmSale(saleId: string, warehouseId: string): Promise<SaleState> {
  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_sale", {
    p_sale_id: saleId,
    p_warehouse_id: warehouseId,
  });

  if (error) {
    console.error("confirmSale:", error.code, error.message);
    if (error.message.includes("not_authenticated")) return { ok: false, error: "common.errors.signInAgain" };
    if (error.message.includes("permission_denied")) return { ok: false, error: "common.errors.permissionDenied" };
    if (error.message.includes("warehouse_invalid")) return { ok: false, error: "sales.errors.warehouseInvalid" };
    if (error.message.includes("sale_not_draft")) return { ok: false, error: "sales.errors.notDraft" };
    if (error.message.includes("stock_insufficient")) return { ok: false, error: "sales.errors.stockInsufficient" };
    if (error.message.includes("cash_session_required"))
      return {
        ok: false,
        error: "sales.errors.cashSessionRequired",
      };
    return { ok: false, error: "sales.errors.confirmFailed" };
  }

  await logActivity("sale_confirmed", { entityId: saleId });
  revalidatePath(SALES_PATH);
  return { ok: true };
}

export async function markSaleShipped(saleId: string, shippingAddress: string): Promise<SaleState> {
  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_sale_shipped", {
    p_sale_id: saleId,
    p_shipping_address: shippingAddress,
  });

  if (error) {
    console.error("markSaleShipped:", error.code, error.message);
    if (error.message.includes("not_authenticated")) return { ok: false, error: "common.errors.signInAgain" };
    if (error.message.includes("shipping_address_required")) return { ok: false, error: "sales.errors.addressRequired" };
    if (error.message.includes("sale_not_confirmed_or_not_found")) return { ok: false, error: "sales.errors.notConfirmed" };
    return { ok: false, error: "sales.errors.shipFailed" };
  }

  revalidatePath(SALES_PATH);
  return { ok: true };
}

export async function markSaleDelivered(saleId: string): Promise<SaleState> {
  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_sale_delivered", {
    p_sale_id: saleId,
  });

  if (error) {
    console.error("markSaleDelivered:", error.code, error.message);
    if (error.message.includes("not_authenticated")) return { ok: false, error: "common.errors.signInAgain" };
    if (error.message.includes("sale_not_confirmed_or_shipped")) return { ok: false, error: "sales.errors.notShippedOrConfirmed" };
    return { ok: false, error: "sales.errors.deliverFailed" };
  }

  revalidatePath(SALES_PATH);
  return { ok: true };
}

/**
 * S23-01: anula una venta (solo owner/admin; cancel_sale lo valida). Devuelve el stock al costo
 * congelado y registra la devolución de los cobros; en efectivo exige la caja abierta.
 */
export async function cancelSale(saleId: string): Promise<SaleState> {
  const id = z.uuid().safeParse(saleId);
  if (!id.success) return { ok: false, error: "sales.errors.saleInvalid" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_sale", { p_sale_id: id.data });
  if (error) {
    console.error("cancelSale:", error.code, error.message);
    if (error.message.includes("permission_denied")) return { ok: false, error: "sales.errors.cancelAdminOnly" };
    if (error.message.includes("sale_already_cancelled")) return { ok: false, error: "sales.errors.alreadyCancelled" };
    if (error.message.includes("cash_session_required"))
      return { ok: false, error: "sales.errors.cancelCashRequired" };
    return { ok: false, error: "sales.errors.cancelFailed" };
  }

  await logActivity("sale_cancelled", { entityId: id.data });
  revalidatePath(SALES_PATH);
  revalidatePath("/ventas/clientes", "layout");
  return { ok: true };
}
