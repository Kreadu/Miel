import { z } from "zod";

export const onboardingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "El nombre de la empresa es obligatorio" }),
  nit: z.string().trim().optional(),
});
