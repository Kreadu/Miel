import { describe, expect, it } from "vitest";

import { groupByProduct, splitTotal, toPurchaseItems } from "./warehouse-split";

const P = "11111111-1111-4111-8111-111111111111";
const W1 = { id: "w1", is_default: true };
const W2 = { id: "w2", is_default: false };

describe("cantidades por bodega (S26-11)", () => {
  it("con varias bodegas, un ítem por bodega con cantidad > 0", () => {
    const line = { product_id: P, unit_cost: "100", tax_rate: "19", qty: "", byWarehouse: { w1: "20", w2: "10", w3: "0" } };
    expect(toPurchaseItems([line], [W1, W2])).toEqual([
      { product_id: P, warehouse_id: "w1", qty: "20", unit_cost: "100", tax_rate: "19" },
      { product_id: P, warehouse_id: "w2", qty: "10", unit_cost: "100", tax_rate: "19" },
    ]);
    expect(splitTotal(line, [W1, W2])).toBe(30);
  });

  it("con una sola bodega, la cantidad única va a esa bodega", () => {
    const line = { product_id: P, unit_cost: "5", tax_rate: "0", qty: "3", byWarehouse: {} };
    expect(toPurchaseItems([line], [W1])).toEqual([{ product_id: P, warehouse_id: "w1", qty: "3", unit_cost: "5", tax_rate: "0" }]);
    expect(splitTotal(line, [W1])).toBe(3);
  });

  it("sin producto elegido no se envía", () => {
    expect(toPurchaseItems([{ product_id: "", unit_cost: "1", tax_rate: "0", qty: "1", byWarehouse: {} }], [W1])).toEqual([]);
  });

  it("al editar, agrupa los ítems del mismo producto y costo; los viejos sin bodega van a la principal", () => {
    expect(
      groupByProduct(
        [
          { product_id: P, warehouse_id: "w1", qty: 20, unit_cost: 100, tax_rate: 19 },
          { product_id: P, warehouse_id: null, qty: 5, unit_cost: 100, tax_rate: 19 },
          { product_id: P, warehouse_id: "w2", qty: 10, unit_cost: 100, tax_rate: 19 },
        ],
        [W1, W2],
      ),
    ).toEqual([{ product_id: P, unit_cost: "100", tax_rate: "19", qty: "35", byWarehouse: { w1: "25", w2: "10" } }]);
  });
});
