import { z } from "zod";

export const EXPENSE_KINDS = ["fixed", "variable"] as const;
export const EXPENSE_METHODS = ["cash", "transfer", "card", "other"] as const;

/**
 * S22-01: gasto. El tipo (fijo/variable) lo manda la categoría en la BD (trigger); el del
 * formulario es el de la hoja en la que se anota. La fecha es un día: se guarda a mediodía de
 * Bogotá para que nunca caiga en el día anterior.
 */
export const expenseSchema = z
  .object({
    kind: z.enum(EXPENSE_KINDS),
    category: z.string().trim().min(1, "Elige la categoría"),
    description: z.string().trim().min(1, "Escribe una descripción").max(300, "Descripción muy larga"),
    amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
    // S23-01: IVA descontable incluido en el monto (se recupera: no es gasto). Vacío = 0.
    tax_amount: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0, "El IVA no puede ser negativo")),
    method: z.enum(EXPENSE_METHODS, { error: "Elige la forma de pago" }),
    paid_on: z.iso.date("Fecha inválida"),
    supplier_id: z
      .union([z.literal(""), z.uuid("Proveedor inválido")])
      .optional()
      .transform((v) => v || null),
  })
  .refine((d) => d.tax_amount <= d.amount, { message: "El IVA no puede ser mayor al monto", path: ["tax_amount"] })
  .transform(({ paid_on, ...rest }) => ({
    ...rest,
    paid_at: new Date(`${paid_on}T12:00:00-05:00`).toISOString(),
  }));

export type ExpenseInput = z.infer<typeof expenseSchema>;

/** S22-01: categoría de gasto propia, con su tipo. */
export const expenseCategorySchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre").max(80, "Nombre muy largo"),
  kind: z.enum(EXPENSE_KINDS),
});
