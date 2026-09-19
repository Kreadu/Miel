import { describe, expect, it } from "vitest";

import { purchaseItemSchema, purchaseSchema } from "./purchases";

const validItem = {
  product_id: "11111111-1111-4111-8111-111111111111",
  qty: 2,
  unit_cost: 100,
  tax_rate: 19,
};

describe("purchaseItemSchema", () => {
  it("acepta un ítem válido", () => {
    expect(purchaseItemSchema.safeParse(validItem).success).toBe(true);
  });

  it("rechaza qty cero o negativa", () => {
    expect(purchaseItemSchema.safeParse({ ...validItem, qty: 0 }).success).toBe(false);
    expect(purchaseItemSchema.safeParse({ ...validItem, qty: -1 }).success).toBe(false);
  });

  it("rechaza unit_cost negativo", () => {
    expect(purchaseItemSchema.safeParse({ ...validItem, unit_cost: -1 }).success).toBe(false);
  });

  it("rechaza tax_rate fuera de rango", () => {
    expect(purchaseItemSchema.safeParse({ ...validItem, tax_rate: -1 }).success).toBe(false);
    expect(purchaseItemSchema.safeParse({ ...validItem, tax_rate: 101 }).success).toBe(false);
  });

  it("tax_rate es opcional y default a 0", () => {
    const withoutTaxRate = { product_id: validItem.product_id, qty: validItem.qty, unit_cost: validItem.unit_cost };
    const result = purchaseItemSchema.safeParse(withoutTaxRate);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tax_rate).toBe(0);
  });
});

describe("purchaseSchema", () => {
  const validPurchase = {
    supplier_id: "22222222-2222-4222-8222-222222222222",
    status: "draft" as const,
    items: [validItem],
  };

  it("acepta una orden válida con ítems", () => {
    expect(purchaseSchema.safeParse(validPurchase).success).toBe(true);
  });

  it("rechaza una orden sin ítems", () => {
    expect(purchaseSchema.safeParse({ ...validPurchase, items: [] }).success).toBe(false);
  });

  it("rechaza un status inválido", () => {
    expect(purchaseSchema.safeParse({ ...validPurchase, status: "received" }).success).toBe(
      false,
    );
  });

  it("acepta status ordered", () => {
    expect(purchaseSchema.safeParse({ ...validPurchase, status: "ordered" }).success).toBe(
      true,
    );
  });
});
