import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120, "Nombre muy largo"),
  nit: z.string().trim().max(30, "NIT muy largo").optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .max(160, "Email muy largo")
    .refine((v) => v === "" || z.email().safeParse(v).success, "Email inválido")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(30, "Teléfono muy largo").optional().or(z.literal("")),
  address: z.string().trim().max(200, "Dirección muy larga").optional().or(z.literal("")),
});
