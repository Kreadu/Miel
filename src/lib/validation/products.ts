import { z } from "zod";

import { SALES_CHANNELS } from "./catalog";

export const PRODUCT_KINDS = ["raw", "finished", "resale"] as const;

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
});
