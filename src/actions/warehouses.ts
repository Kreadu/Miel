"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { warehouseSchema } from "@/lib/validation/warehouses";

export type WarehouseState = { ok: false; error: string } | { ok: true } | null;

const WAREHOUSES_PATH = "/inventario/bodegas";

/** Solo owner/admin del tenant activo gestionan bodegas (RLS de warehouses lo garantiza igual). */
export async function createWarehouse(
  _prev: WarehouseState,
  formData: FormData,
): Promise<WarehouseState> {
  const parsed = warehouseSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("warehouses")
    .insert({ tenant_id: active.tenantId, name: parsed.data.name });
  if (error) {
    console.error("createWarehouse:", error.code);
    return { ok: false, error: "No se pudo crear la bodega. Intenta de nuevo." };
  }

  revalidatePath(WAREHOUSES_PATH);
  return { ok: true };
}

const updateSchema = warehouseSchema.extend({ id: z.uuid() });

export async function updateWarehouse(
  _prev: WarehouseState,
  formData: FormData,
): Promise<WarehouseState> {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("warehouses")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id);
  if (error) {
    console.error("updateWarehouse:", error.code);
    return { ok: false, error: "No se pudo actualizar la bodega. Intenta de nuevo." };
  }

  revalidatePath(WAREHOUSES_PATH);
  return { ok: true };
}

const toggleSchema = z.object({ id: z.uuid(), active: z.enum(["true", "false"]) });

/** Archivar/reactivar (soft-delete): nunca DELETE físico — stock_movements (S2-03) referenciará warehouse_id. */
export async function toggleWarehouseActive(formData: FormData): Promise<void> {
  const parsed = toggleSchema.safeParse({
    id: formData.get("id"),
    active: formData.get("active"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("warehouses")
    .update({ active: parsed.data.active === "true" })
    .eq("id", parsed.data.id);
  revalidatePath(WAREHOUSES_PATH);
}
