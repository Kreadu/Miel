import { describe, expect, it } from "vitest";

import { stockMovementSchema } from "./stock";

const base = {
  product_id: "123e4567-e89b-12d3-a456-426614174000",
  warehouse_id: "123e4567-e89b-12d3-a456-426614174001",
};

describe("stockMovementSchema", () => {
  it("acepta una entrada válida", () => {
    const valid = { ...base, kind: "in", qty: 10, unit_cost: 100 };
    expect(stockMovementSchema.safeParse(valid).success).toBe(true);
  });

  it("rechaza qty 0", () => {
    const invalid = { ...base, kind: "in", qty: 0, unit_cost: 100 };
    const parsed = stockMovementSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe("La cantidad no puede ser cero.");
    }
  });

  it("rechaza qty negativa para 'in'", () => {
    const invalid = { ...base, kind: "in", qty: -5 };
    const parsed = stockMovementSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe("La cantidad debe ser positiva para este tipo de movimiento.");
    }
  });

  it("acepta qty negativa solo para 'adjust'", () => {
    const valid = { ...base, kind: "adjust", qty: -5 };
    expect(stockMovementSchema.safeParse(valid).success).toBe(true);
  });
});

describe("stockMovementSchema — kind out/adjust (S13-03)", () => {
  it("rechaza salida con cantidad negativa", () => {
    const result = stockMovementSchema.safeParse({ ...base, kind: "out", qty: -5, unit_cost: 0 });
    expect(result.success).toBe(false);
  });

  it("acepta ajuste con cantidad positiva", () => {
    const result = stockMovementSchema.safeParse({ ...base, kind: "adjust", qty: 3, unit_cost: 100 });
    expect(result.success).toBe(true);
  });

  it("rechaza kind inválido", () => {
    const result = stockMovementSchema.safeParse({ ...base, kind: "transfer", qty: 5, unit_cost: 0 });
    expect(result.success).toBe(false);
  });

  it("unit_cost ausente en salida se resuelve a 0", () => {
    const result = stockMovementSchema.safeParse({ ...base, kind: "out", qty: 5 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.unit_cost).toBe(0);
  });
});
