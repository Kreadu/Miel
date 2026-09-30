import { z } from "zod";

export const onboardingSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "onboarding.errors.nameRequired" }),
    nit: z.string().trim().optional(),
    sellsPhysical: z.boolean(),
    sellsVirtual: z.boolean(),
  })
  .refine((data) => data.sellsPhysical || data.sellsVirtual, {
    error: "onboarding.errors.channelRequired",
    path: ["sellsPhysical"],
  });
