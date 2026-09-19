import { z } from "zod";

export const openCashSessionSchema = z.object({
  opening_amount: z.coerce.number().min(0, "El monto base no puede ser negativo."),
});

export const closeCashSessionSchema = z.object({
  counted_amount: z.coerce.number().min(0, "El monto contado no puede ser negativo."),
  session_id: z.uuid("Sesión inválida.").optional().or(z.literal("")),
  note: z.string().trim().max(500, "Nota muy larga").optional().or(z.literal("")),
});
