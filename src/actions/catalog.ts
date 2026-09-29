"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { INVENTORY_IDS } from "@/lib/inventories";
import { categorySchema } from "@/lib/validation/catalog";

export type CategoryResult =
  | { ok: false; error: string }
  | { ok: true; category: { id: string; name: string } };

/** S19-24/S19-26: las categorías se gestionan y se ven en Catálogo y en todos los inventarios. */
function revalidateCategoryPaths() {
  revalidatePath("/ventas/catalogo");
  revalidatePath("/inventario", "layout");
}

const DUPLICATE_CATEGORY = "Ya existe una categoría con ese nombre en este inventario.";
const inventorySchema = z.enum(INVENTORY_IDS);

/**
 * S19-16/S19-28: alta de categoría en un inventario (cada inventario tiene las suyas). Devuelve
 * la categoría creada para que el selector la deje elegida sin recargar el formulario.
 */
export async function createCategory(name: string, inventory: string): Promise<CategoryResult> {
  const parsed = categorySchema.safeParse({ name });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const parsedInventory = inventorySchema.safeParse(inventory);
  if (!parsedInventory.success) return { ok: false, error: "Inventario inválido." };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_categories")
    .insert({ tenant_id: active.tenantId, inventory: parsedInventory.data, name: parsed.data.name })
    .select("id, name")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: DUPLICATE_CATEGORY };
    console.error("createCategory:", error?.code);
    return { ok: false, error: "No se pudo crear la categoría. Intenta de nuevo." };
  }

  revalidateCategoryPaths();
  return { ok: true, category: data };
}

export type CategoryMutationResult = { ok: false; error: string } | { ok: true };

const categoryIdSchema = z.uuid();

/** S19-21: renombrar categoría (solo owner/admin por RLS; 0 filas = sin permiso o ajena). */
export async function renameCategory(id: string, name: string): Promise<CategoryMutationResult> {
  const parsedId = categoryIdSchema.safeParse(id);
  const parsed = categorySchema.safeParse({ name });
  if (!parsedId.success) return { ok: false, error: "Categoría inválida." };
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_categories")
    .update({ name: parsed.data.name })
    .eq("id", parsedId.data)
    .select("id");
  if (error) {
    if (error.code === "23505") return { ok: false, error: DUPLICATE_CATEGORY };
    console.error("renameCategory:", error.code);
    return { ok: false, error: "No se pudo renombrar la categoría. Intenta de nuevo." };
  }
  if (!data?.length) return { ok: false, error: "No se pudo renombrar la categoría." };

  revalidateCategoryPaths();
  return { ok: true };
}

/** S19-21: eliminar categoría — sus productos quedan sin categoría (`on delete set null`). */
export async function deleteCategory(id: string): Promise<CategoryMutationResult> {
  const parsedId = categoryIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Categoría inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_categories")
    .delete()
    .eq("id", parsedId.data)
    .select("id");
  if (error) {
    console.error("deleteCategory:", error.code);
    return { ok: false, error: "No se pudo eliminar la categoría. Intenta de nuevo." };
  }
  if (!data?.length) return { ok: false, error: "No se pudo eliminar la categoría." };

  revalidateCategoryPaths();
  return { ok: true };
}

export type CartProductData = {
  id: string;
  name: string;
  price: number;
  discount_percent: number;
  tax_rate: number;
  weight_kg: number;
};

/**
 * S19-11: el carrito del catálogo guarda una foto de precio/descuento/IVA al agregar el
 * producto (localStorage) — esto trae los datos frescos de la BD para reconciliar el carrito
 * cada vez que se abre el Pedido, sin depender de que el humano lo vacíe y vuelva a armar.
 */
export async function refreshCartProductData(productIds: string[]): Promise<CartProductData[]> {
  if (productIds.length === 0) return [];

  const { active } = await getActiveTenant();
  if (!active) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products_catalog")
    .select("id, name, price, discount_percent, tax_rate, weight_kg")
    .eq("tenant_id", active.tenantId)
    .in("id", productIds);
  if (error || !data) return [];

  return data
    .filter((p): p is typeof p & { id: string; name: string } => p.id != null && p.name != null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price ?? 0,
      discount_percent: p.discount_percent ?? 0,
      tax_rate: p.tax_rate ?? 0,
      weight_kg: p.weight_kg ?? 0,
    }));
}
