import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(1, "customers.errors.nameRequired").max(120, "common.errors.nameTooLong"),
  doc_type: z.enum(["nit", "cc", "ce", "other"], {
    message: "customers.errors.docTypeInvalid",
  }),
  doc_number: z.string().trim().max(30, "customers.errors.docTooLong").optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .max(160, "customers.errors.emailTooLong")
    .refine((v) => v === "" || z.email().safeParse(v).success, "customers.errors.emailInvalid")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(30, "customers.errors.phoneTooLong").optional().or(z.literal("")),
  address: z.string().trim().max(200, "customers.errors.addressTooLong").optional().or(z.literal("")),
  note: z.string().trim().max(500, "common.errors.noteTooLong").optional().or(z.literal("")),
});
