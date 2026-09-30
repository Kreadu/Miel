"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logActivity } from "@/lib/activity/log";
import { getOrCreateGenericCustomerId } from "@/lib/customers/generic";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { allocationsSchema, checkoutSchema, saleSchema } from "@/lib/validation/sales";

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
  // S18-06: errores de confirmar/cobrar dentro de checkout_counter_sale.
  if (message?.includes("payment_method_required")) return "sales.errors.paymentMethodRequired";
  if (message?.includes("invoice_customer_required")) return "sales.errors.invoiceCustomerRequired";
  if (message?.includes("cash_session_required")) return "sales.errors.cashSessionRequired";
  if (message?.includes("stock_insufficient")) return "sales.errors.stockInsufficient";
  if (message?.includes("warehouse_invalid")) return "sales.errors.warehouseInvalid";
  if (message?.includes("warehouse_not_lending")) return "sales.errors.warehouseNotLending";
  if (message?.includes("allocation_mismatch")) return "sales.errors.allocationMismatch";
  return "sales.errors.saveFailed";
}

/** Lee el formulario del carrito: sentinel de mostrador → vacío, `items` en JSON. */
function readCartForm(formData: FormData): Record<string, unknown> | null {
  const raw: Record<string, unknown> = Object.fromEntries(formData);
  if (raw.customer_id === NO_CUSTOMER_SENTINEL) raw.customer_id = "";
  // S19-35: un número vacío del form es "no vino" (z.coerce convertiría "" en 0).
  for (const key of ["shipping_km", "shipping_cost"]) if (raw[key] === "") raw[key] = undefined;
  try {
    raw.items = JSON.parse(typeof raw.items === "string" ? raw.items : "[]");
    // S18-10: reparto entre bodegas (solo si se completó desde otra).
    raw.allocations = typeof raw.allocations === "string" && raw.allocations ? JSON.parse(raw.allocations) : undefined;
  } catch {
    return null;
  }
  return raw;
}

/** Cualquier miembro del tenant activo crea ventas (create_sale lo valida igual: pertenencia, no rol admin). */
export async function createSale(_prev: SaleState, formData: FormData): Promise<SaleState> {
  const raw = readCartForm(formData);
  if (!raw) return { ok: false, error: "sales.errors.itemsInvalid" };

  const parsed = saleSchema.safeParse(raw);
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

/** S18-10: con `allocations` (reparto entre bodegas) usa `confirm_sale_allocated`. */
export async function confirmSale(saleId: string, warehouseId: string, allocations?: unknown): Promise<SaleState> {
  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const parsedAllocations = allocations === undefined ? null : allocationsSchema.safeParse(allocations);
  if (parsedAllocations && !parsedAllocations.success) {
    return { ok: false, error: parsedAllocations.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = parsedAllocations
    ? await supabase.rpc("confirm_sale_allocated", {
        p_sale_id: saleId,
        p_warehouse_id: warehouseId,
        p_allocations: parsedAllocations.data,
      })
    : await supabase.rpc("confirm_sale", {
        p_sale_id: saleId,
        p_warehouse_id: warehouseId,
      });

  if (error) {
    console.error("confirmSale:", error.code, error.message);
    if (error.message.includes("not_authenticated")) return { ok: false, error: "common.errors.signInAgain" };
    if (error.message.includes("permission_denied")) return { ok: false, error: "common.errors.permissionDenied" };
    if (error.message.includes("warehouse_invalid")) return { ok: false, error: "sales.errors.warehouseInvalid" };
    if (error.message.includes("warehouse_not_lending")) return { ok: false, error: "sales.errors.warehouseNotLending" };
    if (error.message.includes("allocation_mismatch")) return { ok: false, error: "sales.errors.allocationMismatch" };
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
    if (error.message.includes("sale_has_payments")) return { ok: false, error: "sales.errors.saleHasPayments" };
    if (error.message.includes("cash_session_required"))
      return { ok: false, error: "sales.errors.cancelCashRequired" };
    return { ok: false, error: "sales.errors.cancelFailed" };
  }

  await logActivity("sale_cancelled", { entityId: id.data });
  revalidatePath(SALES_PATH);
  revalidatePath("/ventas/clientes", "layout");
  return { ok: true };
}

/**
 * S18-06: venta de mostrador en un paso — crea, genera la boleta (stock + caja), cobra el total
 * con la forma de pago elegida y la deja entregada, todo en `checkout_counter_sale` (atómica).
 * Factura: exige un cliente identificado; queda "por emitir" (Miel no emite DIAN, S25-01).
 */
export async function checkoutCounterSale(_prev: SaleState, formData: FormData): Promise<SaleState> {
  const raw = readCartForm(formData);
  if (!raw) return { ok: false, error: "sales.errors.itemsInvalid" };

  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;
  if (data.document_type === "factura" && !data.customer_id) {
    return { ok: false, error: "sales.errors.invoiceCustomerRequired" };
  }

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const supabase = await createClient();
  const customerId = data.customer_id || (await getOrCreateGenericCustomerId(supabase, active.tenantId));
  if (!customerId) return { ok: false, error: "sales.errors.saveFailed" };

  const { data: saleId, error } = await supabase.rpc("checkout_counter_sale", {
    p_tenant_id: active.tenantId,
    p_items: data.items,
    p_customer_id: customerId,
    p_payment_method: data.payment_method,
    p_warehouse_id: data.warehouse_id,
    p_document_type: data.document_type,
    p_note: data.note || undefined,
    p_allocations: data.allocations,
  });
  if (error) {
    console.error("checkoutCounterSale:", error.code, error.message);
    return { ok: false, error: mapSaleError(error.message) };
  }

  await logActivity("sale_confirmed", { entityId: saleId ?? undefined });
  await logActivity("payment_registered", { entityId: saleId ?? undefined, detail: data.payment_method });
  revalidatePath(SALES_PATH);
  revalidatePath("/ventas/caja");
  return { ok: true };
}

/** S18-06: el dueño emitió la factura en su sistema de facturación (owner/admin; la RPC lo valida). */
export async function markInvoiceIssued(saleId: string): Promise<SaleState> {
  const id = z.uuid().safeParse(saleId);
  if (!id.success) return { ok: false, error: "sales.errors.saleInvalid" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_invoice_issued", { p_sale_id: id.data });
  if (error) {
    console.error("markInvoiceIssued:", error.code, error.message);
    if (error.message.includes("permission_denied")) return { ok: false, error: "common.errors.permissionDenied" };
    return { ok: false, error: "sales.errors.invoiceMarkFailed" };
  }
  revalidatePath(SALES_PATH);
  return { ok: true };
}

const refundSchema = z.object({
  receipt_number: z.coerce.number().int().positive("cash.errors.receiptInvalid"),
  reason: z.string().trim().min(1, "cash.errors.refundReasonRequired").max(300, "common.errors.noteTooLong"),
});

/**
 * S18-08: devolución de una venta cobrada desde Caja (owner/admin con su caja abierta; la RPC
 * lo valida). El dinero sale de su caja y el stock vuelve a la bodega de donde salió.
 */
export async function refundSale(_prev: SaleState, formData: FormData): Promise<SaleState> {
  const parsed = refundSchema.safeParse({
    receipt_number: formData.get("receipt_number"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const supabase = await createClient();
  const { data: saleId, error } = await supabase.rpc("refund_sale", {
    p_tenant_id: active.tenantId,
    p_receipt_number: parsed.data.receipt_number,
    p_reason: parsed.data.reason,
  });
  if (error) {
    console.error("refundSale:", error.code, error.message);
    if (error.message.includes("permission_denied")) return { ok: false, error: "common.errors.permissionDenied" };
    if (error.message.includes("cash_session_required")) return { ok: false, error: "cash.errors.refundCashRequired" };
    if (error.message.includes("refund_reason_required")) return { ok: false, error: "cash.errors.refundReasonRequired" };
    if (error.message.includes("sale_not_found")) return { ok: false, error: "cash.errors.receiptNotFound" };
    if (error.message.includes("sale_already_cancelled")) return { ok: false, error: "sales.errors.alreadyCancelled" };
    return { ok: false, error: "cash.errors.refundFailed" };
  }

  await logActivity("sale_refunded", { entityId: saleId ?? undefined, detail: parsed.data.reason });
  revalidatePath("/ventas/caja");
  revalidatePath(SALES_PATH);
  revalidatePath("/ventas/clientes", "layout");
  return { ok: true };
}
