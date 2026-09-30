import { z } from "zod";

export const customerPaymentSchema = z.object({
  customer_id: z.uuid("payments.errors.customerInvalid"),
  sale_id: z.uuid("sales.errors.saleInvalid").optional().or(z.literal("")),
  amount: z.coerce.number().positive("payments.errors.amountPositive"),
  method: z.enum(["cash", "transfer", "card", "other"], "payments.errors.methodInvalid"),
  paid_at: z.string().optional().or(z.literal("")),
  note: z.string().trim().max(500, "common.errors.noteTooLong").optional().or(z.literal("")),
});
