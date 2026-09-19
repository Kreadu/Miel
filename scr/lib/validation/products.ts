import { z } from "zod";

export const PRODUCT_KINDS = ["raw", "finished", "resale"] as const;

export const productSchema = z.object({
  sku: z.string().trim().min(1, "El SKU es obligatorio").max(60, "SKU muy largo"),
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
});

/** Alta unificada (S13-01): ficha del producto + stock inicial opcional en una sola operación. */
export const productWithStockSchema = productSchema
  .extend({
    warehouse_id: z.string().trim().uuid("Selecciona una bodega válida.").optional().or(z.literal("")),
    initial_qty: z.coerce.number().nonnegative("La cantidad no puede ser negativa").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.initial_qty && data.initial_qty > 0 && !data.warehouse_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona una bodega para registrar el stock inicial.",
        path: ["warehouse_id"],
      });
    }
  });
