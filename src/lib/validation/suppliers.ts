import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "common.errors.nameRequired").max(120, "common.errors.nameTooLong"),
  nit: z.string().trim().max(30, "suppliers.errors.nitTooLong").optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .max(160, "customers.errors.emailTooLong")
    .refine((v) => v === "" || z.email().safeParse(v).success, "customers.errors.emailInvalid")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(30, "customers.errors.phoneTooLong").optional().or(z.literal("")),
  address: z.string().trim().max(200, "customers.errors.addressTooLong").optional().or(z.literal("")),
});
