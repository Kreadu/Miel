"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

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
  if (message?.includes("approval_required")) return "purchases.errors.approvalRequired";
  if (message?.includes("display_name_required")) return "purchases.errors.displayNameRequired";
  if (message?.includes("purchase_not_pending")) return "purchases.errors.notPending";
  if (message?.includes("approver_invalid")) return "purchases.errors.approverInvalid";
  if (message?.includes("purchase_has_payments")) return "purchases.errors.hasPayments";
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

/** S26-02: solo aprobadores (dueño o admin marcado) aprueban (approve_purchase lo valida). */
export async function approvePurchase(purchaseId: string): Promise<PurchaseState> {
  const parsed = z.uuid().safeParse(purchaseId);
  if (!parsed.success) return { ok: false, error: "purchases.errors.purchaseInvalid" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_purchase", { p_purchase_id: parsed.data });

  if (error) {
    console.error("approvePurchase:", error.code, error.message);
    return { ok: false, error: mapPurchaseError(error.message) };
  }

  revalidatePath(PURCHASES_PATH);
  return { ok: true };
}

const approverSchema = z.object({ membershipId: z.uuid(), value: z.boolean() });

/** S26-02: solo el dueño marca qué admins aprueban órdenes (set_purchase_approver lo valida). */
export async function setPurchaseApprover(membershipId: string, value: boolean): Promise<PurchaseState> {
  const parsed = approverSchema.safeParse({ membershipId, value });
  if (!parsed.success) return { ok: false, error: "purchases.errors.approverInvalid" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_purchase_approver", {
    p_membership_id: parsed.data.membershipId,
    p_value: parsed.data.value,
  });

  if (error) {
    console.error("setPurchaseApprover:", error.code, error.message);
    return { ok: false, error: mapPurchaseError(error.message) };
  }

  revalidatePath("/equipo/usuarios");
  return { ok: true };
}
