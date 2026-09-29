import { describe, expect, it } from "vitest";

import { totalStockByProduct } from "./stock";

describe("totalStockByProduct (S19-17)", () => {
  it("suma las cantidades de todas las bodegas por producto", () => {
    const totals = totalStockByProduct([
      { product_id: "p1", total_qty: 5 },
      { product_id: "p1", total_qty: 7 },
      { product_id: "p2", total_qty: 3 },
    ]);
    expect(totals.get("p1")).toBe(12);
    expect(totals.get("p2")).toBe(3);
  });

  it("ignora filas sin producto y trata total_qty null como 0", () => {
    const totals = totalStockByProduct([
      { product_id: null, total_qty: 9 },
      { product_id: "p1", total_qty: null },
    ]);
    expect(totals.size).toBe(1);
    expect(totals.get("p1")).toBe(0);
  });
});
