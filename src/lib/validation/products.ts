import { z } from "zod";

import { INVENTORY_IDS } from "@/lib/inventories";

import { SALES_CHANNELS } from "./catalog";

export const PRODUCT_KINDS = ["raw", "finished", "resale", "other"] as const;

/** Texto opcional de formulario: recortado, y vacío → null (columna nullable). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "common.errors.textTooLong")
    .optional()
    .transform((v) => v || null);

/**
 * S19-24: formulario único de producto (Inventario y Catálogo). SKU opcional: vacío = se
 * genera solo. El stock no se carga acá: viene de los movimientos de cada bodega o sucursal.
 */
export const productSchema = z.object({
  sku: z.string().trim().max(60, "products.errors.skuTooLong").optional(),
  name: z.string().trim().min(1, "common.errors.nameRequired").max(120, "common.errors.nameTooLong"),
  description: z.string().trim().max(500, "products.errors.descriptionTooLong").optional(),
  unit: z.string().trim().min(1, "products.errors.unitRequired").max(30, "products.errors.unitTooLong"),
  kind: z.enum(PRODUCT_KINDS),
  cost: z.coerce.number().nonnegative("products.errors.costNegative"),
  price: z.coerce.number().nonnegative("products.errors.priceNegative"),
  tax_rate: z.coerce
    .number()
    .min(0, "products.errors.taxRange")
    .max(100, "products.errors.taxRange"),
  // S19-32: se edita solo en Inventario; en Vender no viene en el form y no se toca.
  min_stock: z.coerce.number().nonnegative("products.errors.minStockNegative").optional(),
  discount_percent: z.coerce
    .number()
    .min(0, "products.errors.discountRange")
    .max(100, "products.errors.discountRange")
    .default(0),
  sales_channel: z.enum(SALES_CHANNELS).default("both"),
  category_id: z.uuid("catalog.errors.categoryInvalid").optional().or(z.literal("")),
  // S19-35: peso en kg, para cotizar el envío por transporte.
  weight_kg: z.coerce.number().nonnegative("products.errors.weightNegative").optional(),
  // S19-26: inventario al que pertenece + datos de vehículos/mobiliario/herramientas.
  inventory: z.enum(INVENTORY_IDS).default("productos"),
  plate: optionalText(20),
  brand: optionalText(80),
  model: optionalText(80),
  color: optionalText(40),
  serial_number: optionalText(80),
  vehicle_year: z
    .union([z.literal(""), z.coerce.number().int("products.errors.yearInvalid").min(1900, "products.errors.yearInvalid").max(2100, "products.errors.yearInvalid")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  purchase_date: z
    .union([z.literal(""), z.iso.date("products.errors.purchaseDateInvalid")])
    .optional()
    .transform((v) => v || null),
});

/** S19-32: cantidad objetivo por bodega o sucursal (campos `stock__<warehouseId>` del form). */
export const stockLevelsSchema = z.array(
  z.object({
    warehouse_id: z.uuid("stock.errors.warehouseInvalid"),
    qty: z.coerce.number().nonnegative("products.errors.stockNegative"),
  }),
);
