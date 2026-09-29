import { z } from "zod";

const money = (label: string) =>
  z.coerce.number().min(0, `${label} no puede ser negativo`).default(0);

/** S19-35: tarifa de un transporte (Vender → Envíos). */
export const shippingRateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60, "Nombre muy largo"),
  base_price: money("El valor base"),
  price_per_kg: money("El valor por kg"),
  price_per_km: money("El valor por km"),
});
