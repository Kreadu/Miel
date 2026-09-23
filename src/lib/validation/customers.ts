import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120, "Nombre muy largo"),
  doc_type: z.enum(["nit", "cc", "ce", "other"], {
    message: "Tipo de documento inválido",
  }),
  doc_number: z.string().trim().max(30, "Documento muy largo").optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .max(160, "Email muy largo")
    .refine((v) => v === "" || z.email().safeParse(v).success, "Email inválido")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(30, "Teléfono muy largo").optional().or(z.literal("")),
  address: z.string().trim().max(200, "Dirección muy larga").optional().or(z.literal("")),
  note: z.string().trim().max(500, "Nota muy larga").optional().or(z.literal("")),
});
