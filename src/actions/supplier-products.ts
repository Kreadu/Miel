"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { supplierProductSchema } from "@/lib/validation/supplier-products";

export type SupplierProductState = { ok: false; error: string } | { ok: true } | null;

function productosPath(supplierId: string) {
  return `/compras/proveedores/${supplierId}/productos`;
}

function mapSupplierProductError(code: string | undefined): string {
  if (code === "23505") return "Ese producto ya estaba asociado a este proveedor.";
  if (code === "23503") return "Producto o proveedor inválido.";
  return "No se pudo guardar la asociación. Intenta de nuevo.";
}

/** Asociar producto↔proveedor a mano. Solo owner/admin (RLS de supplier_products lo garantiza igual). */
export async function linkSupplierProduct(
  _prev: SupplierProductState,
  formData: FormData,
): Promise<SupplierProductState> {
  const parsed = supplierProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const { error } = await supabase.from("supplier_products").insert({
    tenant_id: active.tenantId,
    supplier_id: parsed.data.supplier_id,
    product_id: parsed.data.product_id,
  });
  if (error) {
    console.error("linkSupplierProduct:", error.code);
    return { ok: false, error: mapSupplierProductError(error.code) };
  }

  revalidatePath(productosPath(parsed.data.supplier_id));
  revalidatePath("/compras/ordenes");
  return { ok: true };
}

/** Quitar la asociación. Solo owner/admin (RLS lo garantiza igual). */
export async function unlinkSupplierProduct(formData: FormData): Promise<void> {
  const parsed = supplierProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("supplier_products")
    .delete()
    .eq("supplier_id", parsed.data.supplier_id)
    .eq("product_id", parsed.data.product_id);

  revalidatePath(productosPath(parsed.data.supplier_id));
  revalidatePath("/compras/ordenes");
}
