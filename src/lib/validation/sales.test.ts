import { describe, expect, it } from "vitest";

import { saleItemSchema, saleSchema } from "./sales";

const validItem = {
  product_id: "11111111-1111-4111-8111-111111111111",
  qty: 2,
  unit_price: 200,
  tax_rate: 19,
};

describe("saleItemSchema", () => {
  it("acepta un ítem válido", () => {
    expect(saleItemSchema.safeParse(validItem).success).toBe(true);
  });

  it("rechaza qty cero o negativa", () => {
    expect(saleItemSchema.safeParse({ ...validItem, qty: 0 }).success).toBe(false);
    expect(saleItemSchema.safeParse({ ...validItem, qty: -1 }).success).toBe(false);
  });

  it("S23-01: descarta precio, IVA y descuento del navegador (los pone la BD)", () => {
    const result = saleItemSchema.safeParse({ ...validItem, discount: 50 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ product_id: validItem.product_id, qty: 2 });
  });
});

describe("saleSchema", () => {
  const validSale = {
    customer_id: "22222222-2222-4222-8222-222222222222",
    items: [validItem],
  };

  it("acepta una venta válida con cliente e ítems", () => {
    expect(saleSchema.safeParse(validSale).success).toBe(true);
  });

  it("acepta una venta sin customer_id (mostrador)", () => {
    expect(saleSchema.safeParse({ items: validSale.items }).success).toBe(true);
  });

  it("acepta customer_id vacío (mostrador desde formulario)", () => {
    expect(saleSchema.safeParse({ ...validSale, customer_id: "" }).success).toBe(true);
  });

  it("rechaza una venta sin ítems", () => {
    expect(saleSchema.safeParse({ ...validSale, items: [] }).success).toBe(false);
  });

  it("acepta payment_method válido", () => {
    expect(saleSchema.safeParse({ ...validSale, payment_method: "cash" }).success).toBe(true);
    expect(saleSchema.safeParse({ ...validSale, payment_method: "card" }).success).toBe(true);
    expect(saleSchema.safeParse({ ...validSale, payment_method: "transfer" }).success).toBe(true);
    expect(saleSchema.safeParse({ ...validSale, payment_method: "other" }).success).toBe(true);
  });

  it("acepta ausencia o vacío de payment_method (opcional)", () => {
    expect(saleSchema.safeParse(validSale).success).toBe(true);
    expect(saleSchema.safeParse({ ...validSale, payment_method: "" }).success).toBe(true);
  });

  it("rechaza payment_method inválido", () => {
    expect(saleSchema.safeParse({ ...validSale, payment_method: "bitcoin" }).success).toBe(false);
  });
});
