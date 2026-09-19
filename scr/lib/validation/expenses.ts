import { z } from "zod";

export const expenseSchema = z.object({
  kind: z.enum(["fixed", "variable"]),
  category: z.string().min(1, "La categoría es requerida"),
  description: z.string().min(1, "La descripción es requerida"),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  method: z.enum(["cash", "transfer", "card", "other"]),
  paid_at: z.string().datetime().optional(),
  supplier_id: z.string().uuid("Proveedor inválido").optional().nullable(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
