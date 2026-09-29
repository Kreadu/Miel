"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ASSET_FIELDS, inventoryById, resolveKind } from "@/lib/inventories";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES } from "@/lib/validation/catalog";
import { productSchema, stockLevelsSchema } from "@/lib/validation/products";

export type ProductState = { ok: false; error: string } | { ok: true } | null;

// Mismo sentinel que CategoryPicker (Radix no admite value="" en un <Select>).
const NO_CATEGORY = "__none__";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** S19-24: Inventario y Catálogo muestran el mismo producto — toda mutación revalida ambos. */
function revalidateProductPaths() {
  // "layout" cubre /inventario y todos sus inventarios (/inventario/<tipo>).
  revalidatePath("/inventario", "layout");
  revalidatePath("/ventas/catalogo");
}

function mapProductError(code: string | undefined, message?: string): string {
  if (code === "23505") return "Ya existe un producto con ese SKU.";
  if (message?.includes("category_inventory_mismatch")) {
    return "Esa categoría es de otro inventario. Elige una de este inventario.";
  }
  return "No se pudo guardar el producto. Intenta de nuevo.";
}

/** SKU vacío en el formulario → se genera solo (el humano puede escribir el suyo). */
function generateSku(): string {
  return `PRD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function readFields(formData: FormData) {
  const get = (k: string) => formData.get(k)?.toString();
  const category = get("category_id");
  return {
    sku: get("sku"),
    name: get("name"),
    description: get("description") || undefined,
    unit: get("unit"),
    kind: get("kind"),
    cost: get("cost"),
    // S19-26: los inventarios que no se venden no muestran precio ni IVA.
    price: get("price") ?? "0",
    tax_rate: get("tax_rate") ?? "0",
    min_stock: get("min_stock") || undefined,
    weight_kg: get("weight_kg") || undefined,
    discount_percent: get("discount_percent") || undefined,
    sales_channel: get("sales_channel") || undefined,
    category_id: category === NO_CATEGORY ? undefined : category || undefined,
    inventory: get("inventory") || undefined,
    ...Object.fromEntries(ASSET_FIELDS.map((f) => [f, get(f)])),
  };
}

/** Columnas explícitas (nunca spread del input) a partir del resultado validado. */
function toColumns(data: z.infer<typeof productSchema>) {
  const sellable = inventoryById(data.inventory).sellable;
  return {
    sku: data.sku || generateSku(),
    name: data.name,
    description: data.description || null,
    unit: data.unit,
    // S19-26: el inventario fija el tipo; lo que no se vende no lleva precio ni descuento.
    kind: resolveKind(data.inventory, data.kind),
    cost: data.cost,
    price: sellable ? data.price : 0,
    tax_rate: data.tax_rate,
    ...(data.min_stock === undefined ? {} : { min_stock: data.min_stock }),
    ...(data.weight_kg === undefined ? {} : { weight_kg: data.weight_kg }),
    discount_percent: sellable ? data.discount_percent : 0,
    sales_channel: data.sales_channel,
    category_id: data.category_id || null,
    inventory: data.inventory,
    plate: data.plate,
    brand: data.brand,
    model: data.model,
    color: data.color,
    serial_number: data.serial_number,
    vehicle_year: data.vehicle_year,
    purchase_date: data.purchase_date,
  };
}

const STOCK_FIELD_PREFIX = "stock__";

/** S19-32: stock por bodega o sucursal editado en el producto (solo viene desde Inventario). */
function readStockLevels(formData: FormData) {
  const levels = [...formData.entries()]
    .filter(([key]) => key.startsWith(STOCK_FIELD_PREFIX))
    .map(([key, value]) => ({
      warehouse_id: key.slice(STOCK_FIELD_PREFIX.length),
      qty: value.toString() || "0",
    }));
  return stockLevelsSchema.safeParse(levels);
}

/** Fija el stock por bodega en una sola RPC atómica (ajustes en el kardex). */
async function saveStockLevels(
  supabase: Supabase,
  productId: string,
  levels: { warehouse_id: string; qty: number }[],
): Promise<boolean> {
  if (levels.length === 0) return true;
  const { error } = await supabase.rpc("set_product_stock", {
    p_product_id: productId,
    p_levels: levels,
  });
  if (error) console.error("saveStockLevels:", error.code, error.message);
  return !error;
}

function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

type UploadResult = { ok: true; url: string | null } | { ok: false; error: string };

/** Sube la foto si vino una en el form; sin foto, `url: null` (alta) o "no reemplazar" (edición). */
async function uploadPhotoIfPresent(
  supabase: Supabase,
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
  const { error } = await supabase.storage
    .from("product-photos")
    .upload(path, photo, { contentType: photo.type });
  if (error) {
    console.error("uploadPhotoIfPresent:", error.message);
    return { ok: false, error: "No se pudo subir la foto. Intenta de nuevo." };
  }

  return { ok: true, url: supabase.storage.from("product-photos").getPublicUrl(path).data.publicUrl };
}

/**
 * S19-24: alta desde Inventario o Catálogo (mismo formulario). Solo owner/admin (RLS de
 * products). El stock no se carga acá: viene de los movimientos de cada bodega o sucursal.
 */
export async function createProduct(
  _prev: ProductState,
  formData: FormData,
): Promise<ProductState> {
  const parsed = productSchema.safeParse(readFields(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const levels = readStockLevels(formData);
  if (!levels.success) return { ok: false, error: levels.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const upload = await uploadPhotoIfPresent(supabase, active.tenantId, formData);
  if (!upload.ok) return { ok: false, error: upload.error };

  const { data: created, error } = await supabase
    .from("products")
    .insert({ tenant_id: active.tenantId, ...toColumns(parsed.data), photo_url: upload.url })
    .select("id")
    .single();
  if (error || !created) {
    console.error("createProduct:", error?.code);
    return { ok: false, error: mapProductError(error?.code, error?.message) };
  }

  // El producto ya quedó creado: un fallo de stock no reabre el form (reintentar duplicaría el
  // producto). Queda en el log; el stock se corrige editando el producto.
  await saveStockLevels(supabase, created.id, levels.data);

  revalidateProductPaths();
  return { ok: true };
}

const updateSchema = productSchema.extend({ id: z.uuid() });

/** S19-24: edición desde Inventario o Catálogo. La foto solo se reemplaza si se sube una nueva. */
export async function updateProduct(
  _prev: ProductState,
  formData: FormData,
): Promise<ProductState> {
  const parsed = updateSchema.safeParse({ ...readFields(formData), id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const levels = readStockLevels(formData);
  if (!levels.success) return { ok: false, error: levels.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const upload = await uploadPhotoIfPresent(supabase, active.tenantId, formData);
  if (!upload.ok) return { ok: false, error: upload.error };

  const columns = toColumns(parsed.data);
  const { error } = await supabase
    .from("products")
    .update(upload.url ? { ...columns, photo_url: upload.url } : columns)
    .eq("id", parsed.data.id);
  if (error) {
    console.error("updateProduct:", error.code);
    return { ok: false, error: mapProductError(error.code, error.message) };
  }

  const stockSaved = await saveStockLevels(supabase, parsed.data.id, levels.data);
  revalidateProductPaths();
  if (!stockSaved) {
    return {
      ok: false,
      error: "Se guardó el producto, pero no se pudo actualizar el stock. Intenta de nuevo.",
    };
  }
  return { ok: true };
}

const toggleSchema = z.object({ id: z.uuid(), active: z.enum(["true", "false"]) });

/** Archivar/reactivar (soft-delete): nunca DELETE físico — stock_movements referencia product_id. */
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
  revalidateProductPaths();
}
