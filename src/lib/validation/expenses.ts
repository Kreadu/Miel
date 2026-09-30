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
    kind: z.enum(EXPENSE_KINDS, { error: "expenses.errors.kindInvalid" }),
    category: z.string().trim().min(1, "expenses.errors.categoryRequired"),
    description: z.string().trim().min(1, "expenses.errors.descriptionRequired").max(300, "products.errors.descriptionTooLong"),
    amount: z.coerce.number().positive("payments.errors.amountPositive"),
    // S23-01: IVA descontable incluido en el monto (se recupera: no es gasto). Vacío = 0.
    tax_amount: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0, "expenses.errors.taxNegative")),
    method: z.enum(EXPENSE_METHODS, { error: "sales.errors.paymentMethodInvalid" }),
    paid_on: z.iso.date("expenses.errors.dateInvalid"),
    supplier_id: z
      .union([z.literal(""), z.uuid("purchases.errors.supplierInvalid")])
      .optional()
      .transform((v) => v || null),
  })
  .refine((d) => d.tax_amount <= d.amount, { message: "expenses.errors.taxExceedsAmount", path: ["tax_amount"] })
  .transform(({ paid_on, ...rest }) => ({
    ...rest,
    paid_at: new Date(`${paid_on}T12:00:00-05:00`).toISOString(),
  }));

export type ExpenseInput = z.infer<typeof expenseSchema>;

/** S22-01: categoría de gasto propia, con su tipo. */
export const expenseCategorySchema = z.object({
  name: z.string().trim().min(1, "common.errors.nameRequired").max(80, "common.errors.nameTooLong"),
  kind: z.enum(EXPENSE_KINDS, { error: "expenses.errors.kindInvalid" }),
});
