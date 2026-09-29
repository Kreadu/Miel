"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getOrCreateCategoryId } from "@/lib/categories/generic";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import {
  ALLOWED_PHOTO_TYPES,
  DEFAULT_TAX_RATE_PERCENT,
  MAX_PHOTO_BYTES,
  catalogProductSchema,
  categorySchema,
} from "@/lib/validation/catalog";

export type CategoryState = { ok: false; error: string } | { ok: true } | null;

const CATEGORIES_PATH = "/ventas/catalogo";

// Mismo sentinel que CatalogProductFields (Radix no admite value="" en un <Select>).
const NO_CATEGORY_SENTINEL = "__none__";

/** S19-15: alta mínima de categoría (solo nombre) — botón "Generar categoría" en el catálogo. */
export async function createCategory(
  _prev: CategoryState,
  formData: FormData,
): Promise<CategoryState> {
  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_categories")
    .insert({ tenant_id: active.tenantId, name: parsed.data.name });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ya existe una categoría con ese nombre." };
    console.error("createCategory:", error.code);
    return { ok: false, error: "No se pudo crear la categoría. Intenta de nuevo." };
  }

  revalidatePath(CATEGORIES_PATH);
  return { ok: true };
}

/**
 * S19-15: resuelve la categoría del form — un nombre nuevo (`new_category_name`) tiene
 * prioridad sobre la categoría elegida del selector (`category_id`); sin ninguno, `null`
 * (sin categoría, campo opcional).
 */
async function resolveCategoryId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  parsed: { category_id?: string; new_category_name?: string },
): Promise<string | null> {
  if (parsed.new_category_name?.trim()) {
    return getOrCreateCategoryId(supabase, tenantId, parsed.new_category_name);
  }
  return parsed.category_id || null;
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
 * S19-14: si se eligió bodega+cantidad en el form, registra una entrada de stock (reusa
 * `register_movement`, S2-03/S13-01 — misma RPC que ya usa el alta de inventario, sin costo
 * porque el catálogo no lo pide). `null` = no se pidió stock (campo opcional, no es un error).
 */
async function registerStockIfPresent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string } | null> {
  const warehouseId = formData.get("warehouse_id")?.toString();
  const qtyRaw = formData.get("stock_qty")?.toString();
  if (!warehouseId || !qtyRaw) return null;

  const qty = Number(qtyRaw);
  if (!(qty > 0)) return null;

  const { error } = await supabase.rpc("register_movement", {
    p_product_id: productId,
    p_warehouse_id: warehouseId,
    p_kind: "in",
    p_qty: qty,
    p_unit_cost: 0,
    p_ref_type: "catalog",
  });
  if (error) {
    console.error("registerStockIfPresent:", error.code, error.message);
    return { ok: false, error: "No se pudo registrar el stock. Intenta de nuevo desde Editar." };
  }
  return { ok: true };
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
    new_category_name: formData.get("new_category_name") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();

  const upload = await uploadPhotoIfPresent(supabase, active.tenantId, formData);
  if (!upload.ok) return { ok: false, error: upload.error };

  const categoryId = await resolveCategoryId(supabase, active.tenantId, parsed.data);

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
      category_id: categoryId,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error("createCatalogProduct insert:", error?.code);
    return { ok: false, error: "No se pudo generar el producto. Intenta de nuevo." };
  }

  // El producto ya quedó creado (insert exitoso) — un fallo de stock acá no debe volver a abrir
  // el formulario (reintentar el submit duplicaría el producto). Se registra en el server log;
  // el humano puede reintentar el stock puntual editando el producto ya creado.
  await registerStockIfPresent(supabase, inserted.id, formData);

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
    new_category_name: formData.get("new_category_name") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();

  const upload = await uploadPhotoIfPresent(supabase, active.tenantId, formData);
  if (!upload.ok) return { ok: false, error: upload.error };

  const categoryId = await resolveCategoryId(supabase, active.tenantId, parsed.data);

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
    category_id: categoryId,
  };
  if (upload.url) updates.photo_url = upload.url;

  const { error } = await supabase.from("products").update(updates).eq("id", parsed.data.id);
  if (error) {
    console.error("updateCatalogProduct:", error.code);
    return { ok: false, error: "No se pudo actualizar el producto. Intenta de nuevo." };
  }

  const stockResult = await registerStockIfPresent(supabase, parsed.data.id, formData);

  revalidatePath(CATALOGO_PATH);
  if (stockResult && !stockResult.ok) return stockResult;
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
