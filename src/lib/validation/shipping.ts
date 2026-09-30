import { z } from "zod";

const money = z.coerce.number().min(0, "shipping.errors.amountNegative").default(0);

/** S19-35: tarifa de un transporte (Vender → Envíos). */
export const shippingRateSchema = z.object({
  name: z.string().trim().min(1, "shipping.errors.nameRequired").max(60, "common.errors.nameTooLong"),
  base_price: money,
  price_per_kg: money,
  price_per_km: money,
});
