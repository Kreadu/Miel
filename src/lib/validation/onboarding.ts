import { z } from "zod";

export const onboardingSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "El nombre de la empresa es obligatorio" }),
    nit: z.string().trim().optional(),
    sellsPhysical: z.boolean(),
    sellsVirtual: z.boolean(),
  })
  .refine((data) => data.sellsPhysical || data.sellsVirtual, {
    error: "Elige al menos un canal de venta: local físico o catálogo online",
    path: ["sellsPhysical"],
  });
