import { z } from "zod";

import { INVENTORY_IDS } from "@/lib/inventories";

import { SALES_CHANNELS } from "./catalog";

export const PRODUCT_KINDS = ["raw", "finished", "resale", "other"] as const;

/** Texto opcional de formulario: recortado, y vacío → null (columna nullable). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Texto muy largo")
    .optional()
    .transform((v) => v || null);

/**
 * S19-24: formulario único de producto (Inventario y Catálogo). SKU opcional: vacío = se
 * genera solo. El stock no se carga acá: viene de los movimientos de cada bodega o sucursal.
 */
export const productSchema = z.object({
  sku: z.string().trim().max(60, "SKU muy largo").optional(),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120, "Nombre muy largo"),
  description: z.string().trim().max(500, "Descripción muy larga").optional(),
  unit: z.string().trim().min(1, "La unidad es obligatoria").max(30, "Unidad muy larga"),
  kind: z.enum(PRODUCT_KINDS),
  cost: z.coerce.number().nonnegative("El costo no puede ser negativo"),
  price: z.coerce.number().nonnegative("El precio no puede ser negativo"),
  tax_rate: z.coerce
    .number()
    .min(0, "El IVA debe estar entre 0 y 100")
    .max(100, "El IVA debe estar entre 0 y 100"),
  min_stock: z.coerce.number().nonnegative("El stock mínimo no puede ser negativo"),
  discount_percent: z.coerce
    .number()
    .min(0, "El descuento debe estar entre 0 y 100")
    .max(100, "El descuento debe estar entre 0 y 100")
    .default(0),
  sales_channel: z.enum(SALES_CHANNELS).default("both"),
  category_id: z.uuid("Categoría inválida").optional().or(z.literal("")),
  // S19-26: inventario al que pertenece + datos de vehículos/mobiliario/herramientas.
  inventory: z.enum(INVENTORY_IDS).default("productos"),
  plate: optionalText(20),
  brand: optionalText(80),
  model: optionalText(80),
  color: optionalText(40),
  serial_number: optionalText(80),
  vehicle_year: z
    .union([z.literal(""), z.coerce.number().int("Año inválido").min(1900, "Año inválido").max(2100, "Año inválido")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  purchase_date: z
    .union([z.literal(""), z.iso.date("Fecha de compra inválida")])
    .optional()
    .transform((v) => v || null),
});
