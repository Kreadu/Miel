import { z } from "zod";

export const stockMovementSchema = z
  .object({
    product_id: z.string().uuid("Selecciona un producto válido."),
    warehouse_id: z.string().uuid("Selecciona una bodega válida."),
    kind: z.enum(["in", "out", "adjust"], {
      error: "Tipo de movimiento inválido."
    }),
    qty: z.coerce.number().refine((val) => val !== 0, {
      message: "La cantidad no puede ser cero.",
    }),
    unit_cost: z.coerce.number().min(0, "El costo no puede ser negativo.").default(0),
    note: z.string().max(255).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind !== "adjust" && data.qty < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La cantidad debe ser positiva para este tipo de movimiento.",
        path: ["qty"],
      });
    }
  });
