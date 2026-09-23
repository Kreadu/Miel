"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { purchaseSchema, updatePurchaseSchema } from "@/lib/validation/purchases";

export type PurchaseState = { ok: false; error: string } | { ok: true } | null;

const PURCHASES_PATH = "/compras/ordenes";

function mapPurchaseError(message: string | undefined): string {
  if (message?.includes("supplier_invalid")) return "Selecciona un proveedor válido y activo.";
  if (message?.includes("product_invalid")) return "Uno de los productos no es válido o está inactivo.";
  if (message?.includes("permission_denied")) return "No tienes permiso para esta operación.";
  if (message?.includes("items_required")) return "Agrega al menos un ítem a la orden.";
  if (message?.includes("item_qty_invalid")) return "La cantidad de un ítem debe ser mayor a cero.";
  if (message?.includes("item_unit_cost_invalid")) return "El costo de un ítem no puede ser negativo.";
  if (message?.includes("purchase_not_found")) return "La orden no existe.";
  if (message?.includes("purchase_not_draft")) return "Solo se puede marcar como ordenada una orden en borrador.";
  if (message?.includes("warehouse_invalid")) return "Selecciona una bodega válida.";
  if (message?.includes("purchase_not_ordered")) return "Solo se puede recibir una orden que esté ordenada.";
  if (message?.includes("purchase_not_cancellable")) return "Esta orden ya no se puede cancelar.";
  if (message?.includes("purchase_not_updatable")) return "Esta orden ya no se puede editar.";
  if (message?.includes("status_invalid")) return "Estado de orden inválido.";
  if (message?.includes("not_authenticated")) return "No estás autenticado.";
  return "No se pudo guardar la orden de compra. Intenta de nuevo.";
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
    return { ok: false, error: "Los ítems de la orden no son válidos." };
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
  if (!parsed.success) return { ok: false, error: "Orden inválida." };

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
  if (!parsed.success) return { ok: false, error: "Selecciona una bodega válida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_purchase", {
    p_purchase_id: parsed.data.purchaseId,
    p_warehouse_id: parsed.data.warehouseId,
  });

  if (error) {
    console.error("receivePurchase:", error.code, error.message);
    return { ok: false, error: mapPurchaseError(error.message) };
  }

  revalidatePath(PURCHASES_PATH);
  return { ok: true };
}

/** Solo owner/admin cancelan (cancel_purchase lo valida igual). */
export async function cancelPurchase(purchaseId: string): Promise<PurchaseState> {
  const parsed = z.uuid().safeParse(purchaseId);
  if (!parsed.success) return { ok: false, error: "Orden inválida." };

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
    return { ok: false, error: "Los ítems de la orden no son válidos." };
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
