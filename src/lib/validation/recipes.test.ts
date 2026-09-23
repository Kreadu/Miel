import { describe, it, expect } from "vitest";
import { recipeSchema } from "./recipes";

describe("recipeSchema", () => {
  it("valida una receta correcta", () => {
    const data = [
      { component_product_id: "123e4567-e89b-12d3-a456-426614174000", qty: 2.5 },
    ];
    const result = recipeSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rechaza qty 0", () => {
    const data = [
      { component_product_id: "123e4567-e89b-12d3-a456-426614174000", qty: 0 },
    ];
    const result = recipeSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rechaza qty negativo", () => {
    const data = [
      { component_product_id: "123e4567-e89b-12d3-a456-426614174000", qty: -1 },
    ];
    const result = recipeSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rechaza id invalido", () => {
    const data = [
      { component_product_id: "not-a-uuid", qty: 1 },
    ];
    const result = recipeSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
