import { describe, expect, it } from "vitest";

import { catalogProductSchema, categorySchema } from "./catalog";

const base = { name: "Miel de abeja 500g", price: "25000" };

describe("catalogProductSchema", () => {
  it("acepta nombre y precio válidos, descuento y canal por defecto", () => {
    const result = catalogProductSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.discount_percent).toBe(0);
      expect(result.data.sales_channel).toBe("both");
    }
  });

  it("acepta los 3 canales de venta válidos", () => {
    expect(catalogProductSchema.safeParse({ ...base, sales_channel: "online" }).success).toBe(
      true,
    );
    expect(catalogProductSchema.safeParse({ ...base, sales_channel: "in_store" }).success).toBe(
      true,
    );
    expect(catalogProductSchema.safeParse({ ...base, sales_channel: "both" }).success).toBe(true);
  });

  it("rechaza un canal de venta inválido", () => {
    expect(catalogProductSchema.safeParse({ ...base, sales_channel: "tienda" }).success).toBe(
      false,
    );
  });

  it("acepta descripción y descuento", () => {
    expect(
      catalogProductSchema.safeParse({
        ...base,
        description: "Miel pura de la región",
        discount_percent: "10",
      }).success,
    ).toBe(true);
  });

  it("rechaza nombre vacío", () => {
    expect(catalogProductSchema.safeParse({ ...base, name: "" }).success).toBe(false);
  });

  it("rechaza precio negativo", () => {
    expect(catalogProductSchema.safeParse({ ...base, price: "-1" }).success).toBe(false);
  });

  it("rechaza descuento negativo", () => {
    expect(catalogProductSchema.safeParse({ ...base, discount_percent: "-5" }).success).toBe(
      false,
    );
  });

  it("rechaza descuento mayor a 100", () => {
    expect(catalogProductSchema.safeParse({ ...base, discount_percent: "150" }).success).toBe(
      false,
    );
  });

  it("acepta category_id opcional, o ninguno", () => {
    expect(catalogProductSchema.safeParse(base).success).toBe(true);
    expect(
      catalogProductSchema.safeParse({
        ...base,
        category_id: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(true);
  });
});

describe("categorySchema", () => {
  it("acepta un nombre válido", () => {
    expect(categorySchema.safeParse({ name: "Endulzantes" }).success).toBe(true);
  });

  it("rechaza nombre vacío", () => {
    expect(categorySchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rechaza nombre de solo espacios", () => {
    expect(categorySchema.safeParse({ name: "   " }).success).toBe(false);
  });
});
