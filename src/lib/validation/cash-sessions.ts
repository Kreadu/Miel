import { z } from "zod";

export const openCashSessionSchema = z.object({
  opening_amount: z.coerce.number().min(0, "cash.errors.openingNegative"),
});

export const closeCashSessionSchema = z.object({
  counted_amount: z.coerce.number().min(0, "cash.errors.countedNegative"),
  session_id: z.uuid("cash.errors.sessionInvalid").optional().or(z.literal("")),
  note: z.string().trim().max(500, "common.errors.noteTooLong").optional().or(z.literal("")),
});
