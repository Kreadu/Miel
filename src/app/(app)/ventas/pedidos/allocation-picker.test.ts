import { describe, expect, it } from "vitest";

import { resolveAllocations } from "./allocation-picker";

const P = "p1";
const MAIN = "cinecultivo";
const OTHER = "kreadu";
const stock = { [P]: { [MAIN]: 5, [OTHER]: 10 } };
const items = [{ productId: P, name: "Miel", qty: 10 }];

describe("resolveAllocations (S18-10)", () => {
  it("si alcanza en la bodega de la venta: sin reparto (flujo de siempre)", () => {
    expect(resolveAllocations([{ ...items[0], qty: 3 }], MAIN, stock, {})).toEqual({ covered: true, allocations: null });
  });

  it("si no alcanza y no se completó: no está cubierto", () => {
    expect(resolveAllocations(items, MAIN, stock, {}).covered).toBe(false);
  });

  it("completado desde otra bodega: reparto 5 + 5", () => {
    expect(resolveAllocations(items, MAIN, stock, { [P]: [{ warehouseId: OTHER, qty: 5 }] })).toEqual({
      covered: true,
      allocations: [
        { product_id: P, warehouse_id: MAIN, qty: 5 },
        { product_id: P, warehouse_id: OTHER, qty: 5 },
      ],
    });
  });

  it("si luego bajó la cantidad, lo completado se recorta", () => {
    const result = resolveAllocations([{ ...items[0], qty: 7 }], MAIN, stock, { [P]: [{ warehouseId: OTHER, qty: 5 }] });
    expect(result.allocations).toEqual([
      { product_id: P, warehouse_id: MAIN, qty: 5 },
      { product_id: P, warehouse_id: OTHER, qty: 2 },
    ]);
  });
});
