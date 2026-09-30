import { z } from "zod";

/** S23-01: datos fiscales de la empresa (exoneración 114-1 en nómina y renta estimada). */
export const fiscalSettingsSchema = z.object({
  person_type: z.enum(["juridica", "natural"], { error: "results.fiscal.errors.personType" }),
  income_tax_rate: z.coerce
    .number({ error: "results.fiscal.errors.rateRequired" })
    .min(0, "results.fiscal.errors.rateRange")
    .max(100, "results.fiscal.errors.rateRange"),
});
