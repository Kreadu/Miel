import { z } from "zod";

export const SALES_CHANNELS = ["online", "in_store", "both"] as const;

export const catalogProductSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120, "Nombre muy largo"),
  description: z.string().trim().max(500, "Descripción muy larga").optional(),
  price: z.coerce.number().nonnegative("El precio no puede ser negativo"),
  discount_percent: z.coerce
    .number()
    .min(0, "El descuento debe estar entre 0 y 100")
    .max(100, "El descuento debe estar entre 0 y 100")
    .default(0),
  sales_channel: z.enum(SALES_CHANNELS).default("both"),
  category_id: z.uuid().optional().or(z.literal("")),
  new_category_name: z.string().trim().max(60, "Nombre de categoría muy largo").optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60, "Nombre muy largo"),
});

export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// IVA estándar de Colombia — mismo default que ya usa `products.tax_rate` (columna, S2-02) y
// el formulario completo de inventario (`product-form.tsx`). El alta simplificada del catálogo
// lo aplicaba en 0 por error (S19-02); corregido en S19-10 para que coincida con el resto de la
// app en vez de asumir "precio final sin IVA aparte".
export const DEFAULT_TAX_RATE_PERCENT = 19;

// Ley exige indicar a qué país corresponde el IVA mostrado (no solo el monto) — no hay un
// campo `country` en `tenants` todavía (solo `currency`, S1-01), así que se fija junto al
// default de la tasa: mismo criterio, mismo país (Colombia) hasta que exista ese campo real.
export const DEFAULT_TAX_COUNTRY_LABEL = "Colombia";
