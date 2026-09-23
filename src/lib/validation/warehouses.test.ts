import { describe, expect, it } from "vitest";

import { warehouseSchema } from "./warehouses";

describe("warehouseSchema", () => {
  it("acepta un nombre válido", () => {
    expect(warehouseSchema.safeParse({ name: "Bodega principal" }).success).toBe(true);
  });

  it("recorta espacios al inicio/fin", () => {
    const result = warehouseSchema.safeParse({ name: "  Bodega  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Bodega");
    }
  });

  it("rechaza nombre vacío", () => {
    expect(warehouseSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rechaza nombre de solo espacios", () => {
    expect(warehouseSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rechaza nombre de más de 120 caracteres", () => {
    expect(warehouseSchema.safeParse({ name: "a".repeat(121) }).success).toBe(false);
  });

  it("acepta nombre de exactamente 120 caracteres", () => {
    expect(warehouseSchema.safeParse({ name: "a".repeat(120) }).success).toBe(true);
  });
});
