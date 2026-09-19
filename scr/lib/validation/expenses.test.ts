import { describe, expect, it } from "vitest";
import { expenseSchema } from "./expenses";

describe("expenseSchema", () => {
  it("valida un gasto valido fijo", () => {
    const data = {
      kind: "fixed",
      category: "Arriendo",
      description: "Pago de mes",
      amount: 1500,
      method: "transfer",
    };
    const result = expenseSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rechaza montos negativos o cero", () => {
    const data = {
      kind: "variable",
      category: "Transporte",
      description: "Flete",
      amount: 0,
      method: "cash",
    };
    const result = expenseSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rechaza metodo invalido", () => {
    const data = {
      kind: "variable",
      category: "Caja",
      description: "Caja menor",
      amount: 50,
      method: "invalid",
    };
    const result = expenseSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("valida proveedor opcional", () => {
    const data = {
      kind: "fixed",
      category: "Arriendo",
      description: "Mes",
      amount: 1000,
      method: "cash",
      supplier_id: "00000000-0000-0000-0000-000000000000",
    };
    const result = expenseSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});
