"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { WAREHOUSE_DETAIL_FIELDS, warehouseSchema } from "@/lib/validation/warehouses";

export type WarehouseState = { ok: false; error: string } | { ok: true } | null;

const WAREHOUSES_PATH = "/inventario/bodegas";

/** Campos del form (nombre + ubicación/contacto de S19-18), como strings para Zod. */
function readFields(formData: FormData) {
  const fields: Record<string, string | undefined> = { name: formData.get("name")?.toString() };
  for (const f of WAREHOUSE_DETAIL_FIELDS) fields[f] = formData.get(f)?.toString();
  return fields;
}

/** Columnas explícitas (nunca spread del input) a partir del resultado validado. */
function toColumns(data: z.infer<typeof warehouseSchema>) {
  return {
    name: data.name,
    address: data.address,
    department: data.department,
    city: data.city,
    country: data.country,
    postal_code: data.postal_code,
    phone: data.phone,
    whatsapp: data.whatsapp,
  };
}

/** Solo owner/admin del tenant activo gestionan bodegas (RLS de warehouses lo garantiza igual). */
export async function createWarehouse(
  _prev: WarehouseState,
  formData: FormData,
): Promise<WarehouseState> {
  const parsed = warehouseSchema.safeParse(readFields(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("warehouses")
    .insert({ tenant_id: active.tenantId, ...toColumns(parsed.data) });
  if (error) {
    console.error("createWarehouse:", error.code);
    return { ok: false, error: "warehouses.errors.createFailed" };
  }

  revalidatePath(WAREHOUSES_PATH);
  return { ok: true };
}

const updateSchema = warehouseSchema.extend({ id: z.uuid() });

export async function updateWarehouse(
  _prev: WarehouseState,
  formData: FormData,
): Promise<WarehouseState> {
  const parsed = updateSchema.safeParse({ id: formData.get("id"), ...readFields(formData) });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("warehouses")
    .update(toColumns(parsed.data))
    .eq("id", parsed.data.id);
  if (error) {
    console.error("updateWarehouse:", error.code);
    return { ok: false, error: "warehouses.errors.updateFailed" };
  }

  revalidatePath(WAREHOUSES_PATH);
  return { ok: true };
}

const toggleSchema = z.object({ id: z.uuid(), active: z.enum(["true", "false"]) });

/**
 * Archivar/reactivar (soft-delete): nunca DELETE físico — stock_movements (S2-03) referencia
 * warehouse_id. La principal (S19-18) no se archiva: la BD lo rechaza por check y la UI no ofrece el botón.
 */
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
