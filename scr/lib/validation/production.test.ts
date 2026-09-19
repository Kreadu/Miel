import { describe, it, expect } from "vitest";
import { registerProductionSchema } from "./production";

const uuid1 = "123e4567-e89b-12d3-a456-426614174000";
const uuid2 = "223e4567-e89b-12d3-a456-426614174000";
const uuid3 = "323e4567-e89b-12d3-a456-426614174000";

describe("registerProductionSchema", () => {
  it("valida una producción correcta con consumos", () => {
    const data = {
      warehouse_id: uuid1,
      product_id: uuid2,
      output_qty: 10,
      consumptions: [{ product_id: uuid3, qty: 2.5 }],
    };
    const result = registerProductionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rechaza bodega inválida", () => {
    const data = {
      warehouse_id: "not-a-uuid",
      product_id: uuid2,
      output_qty: 10,
      consumptions: [{ product_id: uuid3, qty: 1 }],
    };
    const result = registerProductionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rechaza output_qty 0", () => {
    const data = {
      warehouse_id: uuid1,
      product_id: uuid2,
      output_qty: 0,
      consumptions: [{ product_id: uuid3, qty: 1 }],
    };
    const result = registerProductionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rechaza output_qty negativo", () => {
    const data = {
      warehouse_id: uuid1,
      product_id: uuid2,
      output_qty: -5,
      consumptions: [{ product_id: uuid3, qty: 1 }],
    };
    const result = registerProductionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rechaza consumos vacíos", () => {
    const data = {
      warehouse_id: uuid1,
      product_id: uuid2,
      output_qty: 10,
      consumptions: [],
    };
    const result = registerProductionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rechaza qty de consumo 0 o negativo", () => {
    const data = {
      warehouse_id: uuid1,
      product_id: uuid2,
      output_qty: 10,
      consumptions: [{ product_id: uuid3, qty: 0 }],
    };
    const result = registerProductionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rechaza product_id de consumo inválido", () => {
    const data = {
      warehouse_id: uuid1,
      product_id: uuid2,
      output_qty: 10,
      consumptions: [{ product_id: "not-a-uuid", qty: 1 }],
    };
    const result = registerProductionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
