"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { RegisterProductionInput, registerProductionSchema } from "@/lib/validation/production";

export type ProductionState = { ok: false; error: string } | { ok: true } | null;

const PRODUCTION_PATH = "/produccion";

export async function registerProduction(
  input: RegisterProductionInput,
): Promise<ProductionState> {
  const parsed = registerProductionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();

  const { error } = await supabase.rpc("register_production", {
    p_tenant_id: active.tenantId,
    p_warehouse_id: parsed.data.warehouse_id,
    p_product_id: parsed.data.product_id,
    p_output_qty: parsed.data.output_qty,
    p_consumptions: parsed.data.consumptions,
  });

  if (error) {
    console.error("registerProduction:", error.code, error.message);
    if (error.code === "P0001") {
      if (error.message.includes("stock_insufficient")) {
        return { ok: false, error: "Stock insuficiente para algún insumo." };
      }
      if (error.message.includes("product_not_finished")) {
        return { ok: false, error: "El producto destino debe ser un producto terminado." };
      }
      if (error.message.includes("invalid_quantity")) {
        return { ok: false, error: "Cantidades inválidas en la producción." };
      }
      if (error.message.includes("permission_denied")) {
        return { ok: false, error: "No tienes permiso para registrar esta producción." };
      }
    }
    return { ok: false, error: "Error al registrar la producción. Intenta de nuevo." };
  }

  revalidatePath(PRODUCTION_PATH);
  revalidatePath("/inventario");
  return { ok: true };
}
