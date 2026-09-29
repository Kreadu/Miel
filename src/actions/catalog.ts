"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import {
  ALLOWED_PHOTO_TYPES,
  DEFAULT_TAX_RATE_PERCENT,
  MAX_PHOTO_BYTES,
  catalogProductSchema,
  categorySchema,
} from "@/lib/validation/catalog";

export type CategoryResult =
  | { ok: false; error: string }
  | { ok: true; category: { id: string; name: string } };

const CATEGORIES_PATH = "/ventas/catalogo";

// Mismo sentinel que CatalogProductFields (Radix no admite value="" en un <Select>).
const NO_CATEGORY_SENTINEL = "__none__";

/**
 * S19-16: alta de categoría desde el modal "+" del formulario de producto. Devuelve la
 * categoría creada para que el selector la deje elegida sin recargar el formulario.
 */
export async function createCategory(name: string): Promise<CategoryResult> {
  const parsed = categorySchema.safeParse({ name });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_categories")
    .insert({ tenant_id: active.tenantId, name: parsed.data.name })
    .select("id, name")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "Ya existe una categoría con ese nombre." };
    console.error("createCategory:", error?.code);
    return { ok: false, error: "No se pudo crear la categoría. Intenta de nuevo." };
  }

  revalidatePath(CATEGORIES_PATH);
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
    if (error.code === "23505") return { ok: false, error: "Ya existe una categoría con ese nombre." };
    console.error("renameCategory:", error.code);
    return { ok: false, error: "No se pudo renombrar la categoría. Intenta de nuevo." };
  }
  if (!data?.length) return { ok: false, error: "No se pudo renombrar la categoría." };

  revalidatePath(CATEGORIES_PATH);
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

  revalidatePath(CATEGORIES_PATH);
  return { ok: true };
}

export type CatalogProductState = { ok: false; error: string } | { ok: true } | null;

const CATALOGO_PATH = "/ventas/catalogo";

function generateCatalogSku(): string {
  return `CAT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

type UploadResult = { ok: true; url: string | null } | { ok: false; error: string };

/** Sube la foto si vino una en el form; sin foto, `url: null` (alta) o "no reemplazar" (edición). */
async function uploadPhotoIfPresent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  formData: FormData,
): Promise<UploadResult> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { ok: true, url: null };

  if (!ALLOWED_PHOTO_TYPES.includes(photo.type as (typeof ALLOWED_PHOTO_TYPES)[number])) {
    return { ok: false, error: "La foto debe ser JPG, PNG o WEBP." };
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "La foto no puede pesar más de 5 MB." };
  }

  const path = `${tenantId}/${crypto.randomUUID()}.${extensionFor(photo.type)}`;
  const { error: uploadError } = await supabase.storage
    .from("product-photos")
    .upload(path, photo, { contentType: photo.type });
  if (uploadError) {
    console.error("uploadPhotoIfPresent:", uploadError.message);
    return { ok: false, error: "No se pudo subir la foto. Intenta de nuevo." };
  }

  return { ok: true, url: supabase.storage.from("product-photos").getPublicUrl(path).data.publicUrl };
}

/**
 * Alta simplificada de producto desde el catálogo (S19-02): solo nombre/descripción/precio/
 * descuento/foto — la ficha completa (SKU, costo, IVA, tipo, bodega) sigue viviendo en
 * /inventario/productos, misma tabla `products`. RLS (`products_admin_write`) ya restringe el
 * insert a owner/admin, igual que el alta de inventario.
 */
export async function createCatalogProduct(
  _prev: CatalogProductState,
  formData: FormData,
): Promise<CatalogProductState> {
  const parsed = catalogProductSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    price: formData.get("price"),
    discount_percent: formData.get("discount_percent") || 0,
    sales_channel: formData.get("sales_channel") || "both",
    category_id:
      formData.get("category_id") === NO_CATEGORY_SENTINEL
        ? undefined
        : formData.get("category_id") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();

  const upload = await uploadPhotoIfPresent(supabase, active.tenantId, formData);
  if (!upload.ok) return { ok: false, error: upload.error };

  const { data: inserted, error } = await supabase
    .from("products")
    .insert({
      tenant_id: active.tenantId,
      sku: generateCatalogSku(),
      name: parsed.data.name,
      description: parsed.data.description || null,
      unit: "unidad",
      kind: "resale",
      cost: 0,
      price: parsed.data.price,
      tax_rate: DEFAULT_TAX_RATE_PERCENT,
      min_stock: 0,
      photo_url: upload.url,
      discount_percent: parsed.data.discount_percent,
      sales_channel: parsed.data.sales_channel,
      category_id: parsed.data.category_id || null,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error("createCatalogProduct insert:", error?.code);
    return { ok: false, error: "No se pudo generar el producto. Intenta de nuevo." };
  }

  revalidatePath(CATALOGO_PATH);
  return { ok: true };
}

const updateCatalogSchema = catalogProductSchema.extend({ id: z.uuid() });

/**
 * Edición desde el catálogo (S19-03): mismos campos simplificados del alta. La foto solo se
 * reemplaza si se sube una nueva (`uploadPhotoIfPresent` devuelve `url: null` si no vino foto,
 * y en ese caso no se toca `photo_url` en el update).
 */
export async function updateCatalogProduct(
  _prev: CatalogProductState,
  formData: FormData,
): Promise<CatalogProductState> {
  const parsed = updateCatalogSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    price: formData.get("price"),
    discount_percent: formData.get("discount_percent") || 0,
    sales_channel: formData.get("sales_channel") || "both",
    category_id:
      formData.get("category_id") === NO_CATEGORY_SENTINEL
        ? undefined
        : formData.get("category_id") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();

  const upload = await uploadPhotoIfPresent(supabase, active.tenantId, formData);
  if (!upload.ok) return { ok: false, error: upload.error };

  const updates: {
    name: string;
    description: string | null;
    price: number;
    discount_percent: number;
    sales_channel: string;
    category_id: string | null;
    photo_url?: string | null;
  } = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    price: parsed.data.price,
    discount_percent: parsed.data.discount_percent,
    sales_channel: parsed.data.sales_channel,
    category_id: parsed.data.category_id || null,
  };
  if (upload.url) updates.photo_url = upload.url;

  const { error } = await supabase.from("products").update(updates).eq("id", parsed.data.id);
  if (error) {
    console.error("updateCatalogProduct:", error.code);
    return { ok: false, error: "No se pudo actualizar el producto. Intenta de nuevo." };
  }

  revalidatePath(CATALOGO_PATH);
  return { ok: true };
}

export type CartProductData = {
  id: string;
  name: string;
  price: number;
  discount_percent: number;
  tax_rate: number;
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
    .select("id, name, price, discount_percent, tax_rate")
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
    }));
}
