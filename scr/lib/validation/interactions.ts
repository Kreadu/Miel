import { z } from "zod";

export const interactionSchema = z.object({
  customer_id: z.uuid("Cliente inválido"),
  kind: z.enum(["note", "followup", "complaint", "promo"], {
    message: "Tipo de interacción inválido",
  }),
  note: z.string().trim().min(1, "La nota es obligatoria").max(1000, "Nota muy larga"),
  occurred_at: z.string().trim().optional().or(z.literal("")),
});
