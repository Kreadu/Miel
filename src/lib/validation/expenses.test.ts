import { describe, expect, it } from "vitest";

import { expenseCategorySchema, expenseSchema } from "./expenses";

const base = {
  kind: "fixed",
  category: "Arriendo",
  description: "Pago del mes",
  amount: "1500",
  method: "transfer",
  paid_on: "2026-09-05",
};

describe("expenseSchema (S22-01)", () => {
  it("acepta un gasto válido; el monto llega como texto del formulario", () => {
    const r = expenseSchema.safeParse(base);
    expect(r.success && r.data.amount).toBe(1500);
  });

  it("la fecha es un día; se guarda al mediodía de Bogotá", () => {
    const r = expenseSchema.safeParse(base);
    expect(r.success && r.data.paid_at).toBe("2026-09-05T17:00:00.000Z");
  });

  it("rechaza monto cero o negativo, método y tipo desconocidos, categoría vacía", () => {
    expect(expenseSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...base, amount: "-5" }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...base, method: "bitcoin" }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...base, kind: "otro" }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...base, category: "" }).success).toBe(false);
  });

  it("proveedor opcional ('sin proveedor' → null)", () => {
    const r = expenseSchema.safeParse({ ...base, supplier_id: "" });
    expect(r.success && r.data.supplier_id).toBeNull();
  });
});

describe("expenseCategorySchema (S22-01)", () => {
  it("nombre y tipo", () => {
    expect(expenseCategorySchema.safeParse({ name: "Música ambiental", kind: "fixed" }).success).toBe(true);
    expect(expenseCategorySchema.safeParse({ name: " ", kind: "fixed" }).success).toBe(false);
    expect(expenseCategorySchema.safeParse({ name: "X", kind: "otro" }).success).toBe(false);
  });
});
