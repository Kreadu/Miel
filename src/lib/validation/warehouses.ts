import { z } from "zod";

/** Texto opcional de formulario: recortado, y vacío → null (columna nullable). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Texto muy largo")
    .optional()
    .transform((v) => v || null);

export const WAREHOUSE_DETAIL_FIELDS = [
  "address",
  "department",
  "city",
  "country",
  "postal_code",
  "phone",
  "whatsapp",
] as const;

export const warehouseSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120, "Nombre muy largo"),
  // S19-18: ubicación y contacto de la bodega o sucursal (todos opcionales).
  address: optionalText(200),
  department: optionalText(80),
  city: optionalText(80),
  country: optionalText(80),
  postal_code: optionalText(20),
  phone: optionalText(30),
  whatsapp: optionalText(30),
});
