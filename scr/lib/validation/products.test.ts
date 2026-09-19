import { describe, expect, it } from "vitest";

import { productSchema, productWithStockSchema } from "./products";

const valid = {
  sku: "SKU-001",
  name: "Miel de abeja 500g",
  unit: "unidad",
  kind: "resale",
  cost: 10000,
  price: 18000,
  tax_rate: 19,
  min_stock: 5,
};

describe("productSchema", () => {
  it("acepta datos válidos", () => {
    expect(productSchema.safeParse(valid).success).toBe(true);
  });

  it("recorta espacios en sku y nombre", () => {
    const result = productSchema.safeParse({ ...valid, sku: "  SKU-001  ", name: "  Miel  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sku).toBe("SKU-001");
      expect(result.data.name).toBe("Miel");
    }
  });

  it("rechaza sku vacío", () => {
    expect(productSchema.safeParse({ ...valid, sku: "" }).success).toBe(false);
  });

  it("rechaza sku de solo espacios", () => {
    expect(productSchema.safeParse({ ...valid, sku: "   " }).success).toBe(false);
  });

  it("rechaza sku de más de 60 caracteres", () => {
    expect(productSchema.safeParse({ ...valid, sku: "a".repeat(61) }).success).toBe(false);
  });

  it("rechaza nombre vacío", () => {
    expect(productSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("rechaza nombre de más de 120 caracteres", () => {
    expect(productSchema.safeParse({ ...valid, name: "a".repeat(121) }).success).toBe(false);
  });

  it("rechaza unidad vacía", () => {
    expect(productSchema.safeParse({ ...valid, unit: "" }).success).toBe(false);
  });

  it("rechaza description de más de 500 caracteres", () => {
    expect(
      productSchema.safeParse({ ...valid, description: "a".repeat(501) }).success,
    ).toBe(false);
  });

  it("acepta kind raw, finished y resale", () => {
    expect(productSchema.safeParse({ ...valid, kind: "raw" }).success).toBe(true);
    expect(productSchema.safeParse({ ...valid, kind: "finished" }).success).toBe(true);
    expect(productSchema.safeParse({ ...valid, kind: "resale" }).success).toBe(true);
  });

  it("rechaza kind inválido", () => {
    expect(productSchema.safeParse({ ...valid, kind: "otro" }).success).toBe(false);
  });

  it("rechaza cost negativo", () => {
    expect(productSchema.safeParse({ ...valid, cost: -1 }).success).toBe(false);
  });

  it("rechaza price negativo", () => {
    expect(productSchema.safeParse({ ...valid, price: -1 }).success).toBe(false);
  });

  it("rechaza min_stock negativo", () => {
    expect(productSchema.safeParse({ ...valid, min_stock: -1 }).success).toBe(false);
  });

  it("acepta tax_rate en 0 y en 100", () => {
    expect(productSchema.safeParse({ ...valid, tax_rate: 0 }).success).toBe(true);
    expect(productSchema.safeParse({ ...valid, tax_rate: 100 }).success).toBe(true);
  });

  it("rechaza tax_rate fuera de 0-100", () => {
    expect(productSchema.safeParse({ ...valid, tax_rate: -1 }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, tax_rate: 101 }).success).toBe(false);
  });

  it("coacciona strings numéricos (FormData) a número", () => {
    const result = productSchema.safeParse({
      ...valid,
      cost: "10000",
      price: "18000",
      tax_rate: "19",
      min_stock: "5",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cost).toBe(10000);
    }
  });
});

describe("productWithStockSchema (S13-01)", () => {
  it("acepta sin stock inicial (warehouse_id/initial_qty ausentes)", () => {
    expect(productWithStockSchema.safeParse(valid).success).toBe(true);
  });

  it("acepta warehouse_id vacío del <select> sin elegir (string vacío)", () => {
    const result = productWithStockSchema.safeParse({
      ...valid,
      warehouse_id: "",
      initial_qty: "",
    });
    expect(result.success).toBe(true);
  });

  it("acepta con bodega y cantidad válidas", () => {
    const result = productWithStockSchema.safeParse({
      ...valid,
      warehouse_id: "123e4567-e89b-12d3-a456-426614174001",
      initial_qty: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza initial_qty > 0 sin warehouse_id", () => {
    const result = productWithStockSchema.safeParse({
      ...valid,
      initial_qty: 10,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Selecciona una bodega para registrar el stock inicial.",
      );
    }
  });

  it("rechaza initial_qty negativa", () => {
    const result = productWithStockSchema.safeParse({
      ...valid,
      warehouse_id: "123e4567-e89b-12d3-a456-426614174001",
      initial_qty: -1,
    });
    expect(result.success).toBe(false);
  });
});
