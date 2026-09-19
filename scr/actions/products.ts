"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { productSchema, productWithStockSchema } from "@/lib/validation/products";

export type ProductState = { ok: false; error: string } | { ok: true } | null;

const PRODUCTS_PATH = "/inventario/productos";
const INVENTARIO_PATH = "/inventario";

function mapProductError(code: string | undefined, message: string | undefined): string {
  if (code === "23505") return "Ya existe un producto con ese SKU.";
  if (code === "P0001" && message?.includes("warehouse_required")) {
    return "Selecciona una bodega para registrar el stock inicial.";
  }
  if (code === "P0001" && message?.includes("stock_insufficient")) {
    return "Cantidad de stock inicial inválida.";
  }
  return "No se pudo guardar el producto. Intenta de nuevo.";
}

/**
 * Solo owner/admin del tenant activo gestionan productos (RLS de products lo garantiza igual).
 * S13-01: crea el producto y, si se indica bodega+cantidad, su movimiento de stock inicial en
 * una sola operación atómica vía RPC (docs/arch/patron-rpc.md, ADR-030).
 */
export async function createProduct(
  _prev: ProductState,
  formData: FormData,
): Promise<ProductState> {
  const parsed = productWithStockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_product_with_stock", {
    p_tenant_id: active.tenantId,
    p_sku: parsed.data.sku,
    p_name: parsed.data.name,
    p_description: parsed.data.description || undefined,
    p_unit: parsed.data.unit,
    p_kind: parsed.data.kind,
    p_cost: parsed.data.cost,
    p_price: parsed.data.price,
    p_tax_rate: parsed.data.tax_rate,
    p_min_stock: parsed.data.min_stock,
    p_warehouse_id: parsed.data.warehouse_id || undefined,
    p_qty: parsed.data.initial_qty || undefined,
  });
  if (error) {
    console.error("createProduct:", error.code, error.message);
    return { ok: false, error: mapProductError(error.code, error.message) };
  }

  revalidatePath(PRODUCTS_PATH);
  revalidatePath(INVENTARIO_PATH);
  return { ok: true };
}

const updateSchema = productSchema.extend({ id: z.uuid() });

export async function updateProduct(
  _prev: ProductState,
  formData: FormData,
): Promise<ProductState> {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      sku: parsed.data.sku,
      name: parsed.data.name,
      description: parsed.data.description || null,
      unit: parsed.data.unit,
      kind: parsed.data.kind,
      cost: parsed.data.cost,
      price: parsed.data.price,
      tax_rate: parsed.data.tax_rate,
      min_stock: parsed.data.min_stock,
    })
    .eq("id", parsed.data.id);
  if (error) {
    console.error("updateProduct:", error.code);
    return { ok: false, error: mapProductError(error.code, error.message) };
  }

  revalidatePath(PRODUCTS_PATH);
  return { ok: true };
}

const toggleSchema = z.object({ id: z.uuid(), active: z.enum(["true", "false"]) });

/** Archivar/reactivar (soft-delete): nunca DELETE físico — stock_movements (S2-03) referenciará product_id. */
export async function toggleProductActive(formData: FormData): Promise<void> {
  const parsed = toggleSchema.safeParse({
    id: formData.get("id"),
    active: formData.get("active"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("products")
    .update({ active: parsed.data.active === "true" })
    .eq("id", parsed.data.id);
  revalidatePath(PRODUCTS_PATH);
}
