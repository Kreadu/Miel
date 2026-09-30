import { describe, expect, it } from "vitest";

import { shippingCost } from "./shipping";
import { saleSchema } from "./validation/sales";
import { shippingRateSchema } from "./validation/shipping";

const rate = { base_price: 5000, price_per_kg: 1000, price_per_km: 200 };

describe("shippingCost (S19-35)", () => {
  it("base + kg·peso + km·distancia (igual que create_sale)", () => {
    expect(shippingCost(rate, 6, 10)).toBe(13000);
    expect(shippingCost(rate, 0, 0)).toBe(5000);
    expect(shippingCost({ base_price: 0, price_per_kg: 333.33, price_per_km: 0 }, 1.5, 0)).toBe(500);
  });
});

describe("shippingRateSchema (S19-35)", () => {
  it("acepta una tarifa y rechaza negativos o nombre vacío", () => {
    expect(
      shippingRateSchema.safeParse({ name: "Moto", base_price: "5000", price_per_kg: "0", price_per_km: "200" })
        .success,
    ).toBe(true);
    expect(shippingRateSchema.safeParse({ name: "", base_price: "0" }).success).toBe(false);
    expect(shippingRateSchema.safeParse({ name: "X", price_per_km: "-1" }).success).toBe(false);
  });
});

describe("saleSchema — forma de entrega (S19-35)", () => {
  const base = {
    items: [{ product_id: "11111111-1111-4111-8111-111111111111", qty: 1 }],
  };
  const RATE = "22222222-2222-4222-8222-222222222222";

  it("sin forma de entrega sigue siendo válido (Pedidos sin carrito)", () => {
    expect(saleSchema.safeParse(base).success).toBe(true);
  });

  it("retiro en tienda y envío gratis no piden nada más", () => {
    expect(saleSchema.safeParse({ ...base, delivery_method: "pickup" }).success).toBe(true);
    expect(saleSchema.safeParse({ ...base, delivery_method: "free_city" }).success).toBe(true);
  });

  it("acordado exige el monto", () => {
    expect(saleSchema.safeParse({ ...base, delivery_method: "agreed" }).success).toBe(false);
    expect(saleSchema.safeParse({ ...base, delivery_method: "agreed", shipping_cost: "7000" }).success).toBe(true);
  });

  it("transporte exige transporte elegido y km", () => {
    expect(saleSchema.safeParse({ ...base, delivery_method: "carrier", shipping_km: "10" }).success).toBe(false);
    expect(
      saleSchema.safeParse({ ...base, delivery_method: "carrier", shipping_rate_id: RATE }).success,
    ).toBe(false);
    expect(
      saleSchema.safeParse({ ...base, delivery_method: "carrier", shipping_rate_id: RATE, shipping_km: "10" })
        .success,
    ).toBe(true);
  });
});
