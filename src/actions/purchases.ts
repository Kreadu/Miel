"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logActivity } from "@/lib/activity/log";
import { createClient } from "@/lib/supabase/server";
import { purchaseSchema, updatePurchaseSchema } from "@/lib/validation/purchases";

export type PurchaseState = { ok: false; error: string } | { ok: true } | null;

const PURCHASES_PATH = "/compras";

function mapPurchaseError(message: string | undefined): string {
  if (message?.includes("supplier_invalid")) return "purchases.errors.supplierInvalid";
  if (message?.includes("product_invalid")) return "sales.errors.productInvalid";
  if (message?.includes("permission_denied")) return "common.errors.permissionDenied";
  if (message?.includes("items_required")) return "purchases.errors.itemsRequired";
  if (message?.includes("item_qty_invalid")) return "sales.errors.qtyPositive";
  if (message?.includes("item_unit_cost_invalid")) return "products.errors.costNegative";
  if (message?.includes("purchase_not_found")) return "purchases.errors.notFound";
  if (message?.includes("purchase_not_draft")) return "purchases.errors.notDraft";
  if (message?.includes("warehouse_invalid")) return "purchases.errors.warehouseInvalid";
  if (message?.includes("purchase_not_ordered")) return "purchases.errors.notOrdered";
  if (message?.includes("purchase_not_cancellable")) return "purchases.errors.notCancellable";
  if (message?.includes("purchase_not_updatable")) return "purchases.errors.notUpdatable";
  if (message?.includes("status_invalid")) return "purchases.errors.statusInvalid";
  if (message?.includes("not_authenticated")) return "common.errors.signInAgain";
  return "purchases.errors.saveFailed";
}

/** Solo owner/admin del tenant activo crean órdenes (create_purchase lo valida igual). */
export async function createPurchase(
  _prev: PurchaseState,
  formData: FormData,
): Promise<PurchaseState> {
  const raw = Object.fromEntries(formData);
  const itemsRaw = typeof raw.items === "string" ? raw.items : "[]";
  let items: unknown;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { ok: false, error: "purchases.errors.itemsInvalid" };
  }

  const parsed = purchaseSchema.safeParse({ ...raw, items });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_purchase", {
    p_supplier_id: parsed.data.supplier_id,
    p_status: parsed.data.status,
    p_items: parsed.data.items,
    p_note: parsed.data.note || undefined,
  });

  if (error) {
    console.error("createPurchase:", error.code, error.message);
    return { ok: false, error: mapPurchaseError(error.message) };
  }

  revalidatePath(PURCHASES_PATH);
  return { ok: true };
}

const markOrderedSchema = z.object({ id: z.uuid() });

/** Solo owner/admin marcan una orden en borrador como ordenada (mark_purchase_ordered lo valida igual). */
export async function markPurchaseOrdered(
  _prev: PurchaseState,
  formData: FormData,
): Promise<PurchaseState> {
  const parsed = markOrderedSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "purchases.errors.purchaseInvalid" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_purchase_ordered", { p_purchase_id: parsed.data.id });

  if (error) {
    console.error("markPurchaseOrdered:", error.code, error.message);
    return { ok: false, error: mapPurchaseError(error.message) };
  }

  revalidatePath(PURCHASES_PATH);
  return { ok: true };
}

/** Cualquier miembro del tenant recibe una orden ordenada (receive_purchase valida pertenencia, no rol admin). */
export async function receivePurchase(purchaseId: string, warehouseId: string): Promise<PurchaseState> {
  const parsed = z.object({ purchaseId: z.uuid(), warehouseId: z.uuid() }).safeParse({ purchaseId, warehouseId });
  if (!parsed.success) return { ok: false, error: "purchases.errors.warehouseInvalid" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_purchase", {
    p_purchase_id: parsed.data.purchaseId,
    p_warehouse_id: parsed.data.warehouseId,
  });

  if (error) {
    console.error("receivePurchase:", error.code, error.message);
    return { ok: false, error: mapPurchaseError(error.message) };
  }

  await logActivity("purchase_received", { entityId: parsed.data.purchaseId });
  revalidatePath(PURCHASES_PATH);
  return { ok: true };
}

/** Solo owner/admin cancelan (cancel_purchase lo valida igual). */
export async function cancelPurchase(purchaseId: string): Promise<PurchaseState> {
  const parsed = z.uuid().safeParse(purchaseId);
  if (!parsed.success) return { ok: false, error: "purchases.errors.purchaseInvalid" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_purchase", { p_purchase_id: parsed.data });

  if (error) {
    console.error("cancelPurchase:", error.code, error.message);
    return { ok: false, error: mapPurchaseError(error.message) };
  }

  revalidatePath(PURCHASES_PATH);
  return { ok: true };
}

/** Solo owner/admin editan (update_purchase lo valida igual). */
export async function updatePurchase(_prev: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const raw = Object.fromEntries(formData);
  const itemsRaw = typeof raw.items === "string" ? raw.items : "[]";
  let items: unknown;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { ok: false, error: "purchases.errors.itemsInvalid" };
  }

  const parsed = updatePurchaseSchema.safeParse({ ...raw, items });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_purchase", {
    p_purchase_id: parsed.data.id,
    p_supplier_id: parsed.data.supplier_id,
    p_items: parsed.data.items,
    p_note: parsed.data.note || undefined,
  });

  if (error) {
    console.error("updatePurchase:", error.code, error.message);
    return { ok: false, error: mapPurchaseError(error.message) };
  }

  revalidatePath(PURCHASES_PATH);
  return { ok: true };
}
