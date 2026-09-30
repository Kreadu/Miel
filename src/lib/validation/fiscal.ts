import { z } from "zod";

/** S23-01: datos fiscales de la empresa (exoneración 114-1 en nómina y renta estimada). */
export const fiscalSettingsSchema = z.object({
  person_type: z.enum(["juridica", "natural"], { error: "Elige el tipo de persona" }),
  income_tax_rate: z.coerce
    .number({ error: "Escribe la tarifa" })
    .min(0, "La tarifa no puede ser negativa")
    .max(100, "La tarifa no puede superar 100 %"),
});
