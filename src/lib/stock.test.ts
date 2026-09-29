import { describe, expect, it } from "vitest";

import { stockByProduct } from "./stock";

const names = new Map([
  ["w1", "Principal"],
  ["w2", "Centro"],
]);

describe("stockByProduct (S19-17/S19-24)", () => {
  it("agrupa la cantidad por producto con el nombre de cada bodega o sucursal", () => {
    const result = stockByProduct(
      [
        { product_id: "p1", warehouse_id: "w1", total_qty: 5 },
        { product_id: "p1", warehouse_id: "w2", total_qty: 7 },
        { product_id: "p2", warehouse_id: "w1", total_qty: 3 },
      ],
      names,
    );
    expect(result.get("p1")).toEqual([
      { warehouseId: "w1", warehouseName: "Principal", qty: 5 },
      { warehouseId: "w2", warehouseName: "Centro", qty: 7 },
    ]);
    expect(result.get("p2")).toEqual([{ warehouseId: "w1", warehouseName: "Principal", qty: 3 }]);
  });

  it("ignora filas incompletas, null → 0 y bodega desconocida → —", () => {
    const result = stockByProduct(
      [
        { product_id: null, warehouse_id: "w1", total_qty: 9 },
        { product_id: "p1", warehouse_id: "wx", total_qty: null },
      ],
      names,
    );
    expect(result.size).toBe(1);
    expect(result.get("p1")).toEqual([{ warehouseId: "wx", warehouseName: "—", qty: 0 }]);
  });
});
