import { round2 } from "./money";

/** S19-35: formas de entrega del pedido (mismo check que sales.delivery_method). */
export const DELIVERY_METHODS = ["pickup", "free_city", "agreed", "carrier"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export type ShippingRate = { base_price: number; price_per_kg: number; price_per_km: number };

/** Costo de un transporte: base + kg·peso + km·distancia (misma fórmula que create_sale). */
export function shippingCost(rate: ShippingRate, weightKg: number, km: number): number {
  return round2(rate.base_price + rate.price_per_kg * weightKg + rate.price_per_km * km);
}
