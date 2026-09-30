import { z } from "zod";

export const SALES_CHANNELS = ["online", "in_store", "both"] as const;

export const categorySchema = z.object({
  name: z.string().trim().min(1, "common.errors.nameRequired").max(60, "common.errors.nameTooLong"),
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
