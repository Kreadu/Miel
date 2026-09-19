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

  it("rechaza unit_price negativo", () => {
    expect(saleItemSchema.safeParse({ ...validItem, unit_price: -1 }).success).toBe(false);
  });

  it("rechaza tax_rate fuera de rango", () => {
    expect(saleItemSchema.safeParse({ ...validItem, tax_rate: -1 }).success).toBe(false);
    expect(saleItemSchema.safeParse({ ...validItem, tax_rate: 101 }).success).toBe(false);
  });

  it("tax_rate es opcional y default a 0", () => {
    const withoutTaxRate = {
      product_id: validItem.product_id,
      qty: validItem.qty,
      unit_price: validItem.unit_price,
    };
    const result = saleItemSchema.safeParse(withoutTaxRate);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tax_rate).toBe(0);
  });

  it("discount es opcional y default a 0", () => {
    const result = saleItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.discount).toBe(0);
  });

  it("rechaza discount negativo", () => {
    expect(saleItemSchema.safeParse({ ...validItem, discount: -1 }).success).toBe(false);
  });

  it("coerciona discount de string a number", () => {
    const result = saleItemSchema.safeParse({ ...validItem, discount: "15.5" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.discount).toBe(15.5);
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
});
