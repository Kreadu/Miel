"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { stockMovementSchema } from "@/lib/validation/stock";

export type StockState = { ok: false; error: string } | { ok: true } | null;

const STOCK_PATH = "/inventario"; // ruta a decidir donde estará el inventario (S2-04)

export async function registerManualMovement(
  _prev: StockState,
  formData: FormData,
): Promise<StockState> {
  const parsed = stockMovementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_movement", {
    p_product_id: parsed.data.product_id,
    p_warehouse_id: parsed.data.warehouse_id,
    p_kind: parsed.data.kind,
    p_qty: parsed.data.qty,
    p_unit_cost: parsed.data.unit_cost,
    p_ref_type: "manual",
    p_ref_id: undefined,
    p_note: parsed.data.note || undefined,
  });

  if (error) {
    console.error("registerManualMovement:", error.code, error.message);
    if (error.code === "P0001" && error.message.includes("stock_insufficient")) {
      return { ok: false, error: "No hay stock suficiente en esa bodega." };
    }
    if (error.code === "P0001" && error.message.includes("Permission denied")) {
        return { ok: false, error: "No tienes permiso sobre este producto o bodega." };
    }
    return { ok: false, error: "Error al registrar el movimiento. Intenta de nuevo." };
  }

  revalidatePath(STOCK_PATH);
  return { ok: true };
}
