import { z } from "zod";

/** Texto opcional de formulario: recortado, y vacío → null (columna nullable). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "common.errors.textTooLong")
    .optional()
    .transform((v) => v || null);

/** S26-01: datos de la empresa que van en los documentos (orden de compra, E26). */
export const companySchema = z.object({
  name: z.string().trim().min(1, "common.errors.nameRequired").max(120, "common.errors.nameTooLong"),
  nit: optionalText(30),
  address: optionalText(200),
  city: optionalText(80),
  phone: optionalText(30),
  email: z
    .union([z.literal(""), z.email("customers.errors.emailInvalid").max(160)])
    .optional()
    .transform((v) => v || null),
});

/** S26-01: "Tu nombre" (quien pide, aprueba o envía se hace responsable). */
export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "profile.errors.nameRequired")
  .max(80, "common.errors.nameTooLong");

export const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
