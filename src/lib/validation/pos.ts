import { z } from "zod";
import { saleItemSchema } from "./sales";

export const posSchema = z.object({
  warehouse_id: z.uuid("Selecciona una bodega válida."),
  customer_id: z.uuid("Selecciona un cliente válido.").optional().or(z.literal("")),
  items: z.array(saleItemSchema).min(1, "Agrega al menos un ítem."),
  payment_method: z.enum(["cash", "transfer", "card", "other"], {
    message: "Selecciona un método de pago válido.",
  }),
  note: z.string().trim().max(500, "Nota muy larga").optional().or(z.literal("")),
});
