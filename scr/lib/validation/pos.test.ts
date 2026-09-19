import { describe, expect, it } from "vitest";

import { posSchema } from "./pos";

const validItem = {
  product_id: "40000000-0000-4000-a000-0000000010a0",
  qty: 1,
  unit_price: 100,
  tax_rate: 0,
  discount: 0,
};

describe("posSchema", () => {
  const validData = {
    warehouse_id: "30000000-0000-4000-a000-0000000010a0",
    customer_id: "20000000-0000-4000-a000-0000000010a0",
    items: [validItem],
    payment_method: "cash",
    note: "Venta de prueba",
  };

  it("acepta un payload válido con método de pago efectivo", () => {
    expect(posSchema.safeParse(validData).success).toBe(true);
  });

  it("acepta un cliente omitido (mostrador)", () => {
    const data = { ...validData, customer_id: "" };
    expect(posSchema.safeParse(data).success).toBe(true);
  });

  it("rechaza si no tiene ítems", () => {
    const data = { ...validData, items: [] };
    const result = posSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rechaza método de pago inválido", () => {
    const data = { ...validData, payment_method: "crypto" };
    const result = posSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
