import { z } from "zod";

export const interactionSchema = z.object({
  customer_id: z.uuid("interactions.errors.customerInvalid"),
  kind: z.enum(["note", "followup", "complaint", "promo"], {
    message: "interactions.errors.kindInvalid",
  }),
  note: z.string().trim().min(1, "interactions.errors.noteRequired").max(1000, "common.errors.noteTooLong"),
  occurred_at: z.string().trim().optional().or(z.literal("")),
});
