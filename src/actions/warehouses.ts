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
  const fields: Record<string, string | undefined> = {
    name: formData.get("name")?.toString(),
    lends_stock: formData.get("lends_stock")?.toString(),
  };
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
    lends_stock: data.lends_stock,
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

/**
 * S18-10: un clic para que una bodega preste (o no) stock para completar ventas, desde la misma
 * pantalla de Pedidos. Solo owner/admin: la RLS de warehouses no actualiza nada a un operativo.
 */
export async function setWarehouseLends(
  warehouseId: string,
  lends: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = z.uuid().safeParse(warehouseId);
  if (!id.success) return { ok: false, error: "stock.errors.warehouseInvalid" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouses")
    .update({ lends_stock: lends })
    .eq("id", id.data)
    .select("id");
  if (error) {
    console.error("setWarehouseLends:", error.code);
    return { ok: false, error: "warehouses.errors.updateFailed" };
  }
  if (!data?.length) return { ok: false, error: "common.errors.permissionDenied" };

  revalidatePath(WAREHOUSES_PATH);
  revalidatePath("/ventas/pedidos");
  return { ok: true };
}

const transferSchema = z
  .object({
    from: z.uuid("stock.errors.warehouseInvalid"),
    to: z.uuid("stock.errors.warehouseInvalid"),
    items: z
      .array(z.object({ product_id: z.uuid("stock.errors.productInvalid"), qty: z.coerce.number().positive("stock.errors.qtyZero") }))
      .min(1, "warehouses.errors.transferItemsRequired"),
    note: z.string().trim().max(200, "common.errors.noteTooLong").optional(),
  })
  .refine((d) => d.from !== d.to, { message: "warehouses.errors.transferSameWarehouse", path: ["to"] });

/**
 * S19-39: traslado de stock entre bodegas (p. ej. para cerrar una). Sale de una y entra a la otra
 * al mismo costo, en una sola transacción (transfer_stock, solo owner/admin).
 */
export async function transferStock(_prev: WarehouseState, formData: FormData): Promise<WarehouseState> {
  let items: unknown;
  try {
    items = JSON.parse(formData.get("items")?.toString() ?? "[]");
  } catch {
    return { ok: false, error: "warehouses.errors.transferItemsRequired" };
  }
  const parsed = transferSchema.safeParse({
    from: formData.get("from"),
    to: formData.get("to"),
    items,
    note: formData.get("note")?.toString() || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_stock", {
    p_from: parsed.data.from,
    p_to: parsed.data.to,
    p_items: parsed.data.items,
    p_note: parsed.data.note,
  });
  if (error) {
    console.error("transferStock:", error.code, error.message);
    if (error.message.includes("permission_denied")) return { ok: false, error: "common.errors.permissionDenied" };
    if (error.message.includes("stock_insufficient")) return { ok: false, error: "stock.errors.insufficient" };
    if (error.message.includes("warehouse_invalid")) return { ok: false, error: "stock.errors.warehouseInvalid" };
    return { ok: false, error: "warehouses.errors.transferFailed" };
  }

  revalidatePath(WAREHOUSES_PATH);
  revalidatePath("/inventario", "layout");
  return { ok: true };
}
