import { describe, expect, it } from "vitest";

import { productSchema } from "./products";

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

describe("productSchema (formulario único, S19-24)", () => {
  it("acepta un producto válido con defaults de catálogo", () => {
    const result = productSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.discount_percent).toBe(0);
      expect(result.data.sales_channel).toBe("both");
    }
  });

  it("recorta espacios de sku y nombre", () => {
    const result = productSchema.safeParse({ ...valid, sku: "  SKU-001  ", name: "  Miel  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sku).toBe("SKU-001");
      expect(result.data.name).toBe("Miel");
    }
  });

  it("SKU vacío u omitido se acepta (se genera solo)", () => {
    expect(productSchema.safeParse({ ...valid, sku: "" }).success).toBe(true);
    expect(productSchema.safeParse({ ...valid, sku: undefined }).success).toBe(true);
  });

  it("rechaza SKU de más de 60 caracteres", () => {
    expect(productSchema.safeParse({ ...valid, sku: "a".repeat(61) }).success).toBe(false);
  });

  it("rechaza nombre vacío o muy largo", () => {
    expect(productSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, name: "a".repeat(121) }).success).toBe(false);
  });

  it("rechaza unidad vacía y descripción muy larga", () => {
    expect(productSchema.safeParse({ ...valid, unit: "" }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, description: "a".repeat(501) }).success).toBe(false);
  });

  it("acepta solo los tres tipos", () => {
    for (const kind of ["raw", "finished", "resale"]) {
      expect(productSchema.safeParse({ ...valid, kind }).success).toBe(true);
    }
    expect(productSchema.safeParse({ ...valid, kind: "otro" }).success).toBe(false);
  });

  it("rechaza costo, precio o stock mínimo negativos", () => {
    expect(productSchema.safeParse({ ...valid, cost: -1 }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, price: -1 }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, min_stock: -1 }).success).toBe(false);
  });

  it("IVA editable entre 0 y 100", () => {
    expect(productSchema.safeParse({ ...valid, tax_rate: 0 }).success).toBe(true);
    expect(productSchema.safeParse({ ...valid, tax_rate: 100 }).success).toBe(true);
    expect(productSchema.safeParse({ ...valid, tax_rate: -1 }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, tax_rate: 101 }).success).toBe(false);
  });

  it("descuento entre 0 y 100", () => {
    expect(productSchema.safeParse({ ...valid, discount_percent: "15" }).success).toBe(true);
    expect(productSchema.safeParse({ ...valid, discount_percent: "-5" }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, discount_percent: "150" }).success).toBe(false);
  });

  it("canal de venta válido", () => {
    expect(productSchema.safeParse({ ...valid, sales_channel: "in_store" }).success).toBe(true);
    expect(productSchema.safeParse({ ...valid, sales_channel: "tienda" }).success).toBe(false);
  });

  it("category_id opcional (uuid o vacío)", () => {
    expect(
      productSchema.safeParse({ ...valid, category_id: "11111111-1111-4111-8111-111111111111" })
        .success,
    ).toBe(true);
    expect(productSchema.safeParse({ ...valid, category_id: "" }).success).toBe(true);
    expect(productSchema.safeParse({ ...valid, category_id: "x" }).success).toBe(false);
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
    if (result.success) expect(result.data.cost).toBe(10000);
  });
});
