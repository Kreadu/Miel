import { z } from "zod";

export const customerPaymentSchema = z.object({
  customer_id: z.uuid("Selecciona un cliente válido."),
  sale_id: z.uuid("Venta inválida.").optional().or(z.literal("")),
  amount: z.coerce.number().positive("El monto debe ser mayor a cero."),
  method: z.enum(["cash", "transfer", "card", "other"], "Selecciona un método de pago válido."),
  paid_at: z.string().optional().or(z.literal("")),
  note: z.string().trim().max(500, "Nota muy larga").optional().or(z.literal("")),
});
