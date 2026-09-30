import { describe, expect, it } from "vitest";

import { resolveAllocations } from "./allocation-picker";

const P = "p1";
const MAIN = "cinecultivo";
const OTHER = "kreadu";
const stock = { [P]: { [MAIN]: 5, [OTHER]: 10 } };
const items = [{ productId: P, name: "Miel", qty: 10 }];

describe("resolveAllocations (S18-10, filas bodega + cantidad)", () => {
  it("si alcanza en la bodega de la venta: sin reparto (flujo de siempre)", () => {
    expect(resolveAllocations([{ ...items[0], qty: 3 }], MAIN, stock, {})).toEqual({ covered: true, allocations: null });
  });

  it("por defecto la primera fila toma lo que alcanza: faltan 5, no está cubierto", () => {
    expect(resolveAllocations(items, MAIN, stock, {}).covered).toBe(false);
  });

  it("5 de Cinecultivo + 5 de Kreadu: cubierto y con reparto", () => {
    const rows = { [P]: [{ warehouseId: MAIN, qty: 5 }, { warehouseId: OTHER, qty: 5 }] };
    expect(resolveAllocations(items, MAIN, stock, rows)).toEqual({
      covered: true,
      allocations: [
        { product_id: P, warehouse_id: MAIN, qty: 5 },
        { product_id: P, warehouse_id: OTHER, qty: 5 },
      ],
    });
  });

  it("si sobra (suma más de lo vendido) no está cubierto", () => {
    const rows = { [P]: [{ warehouseId: MAIN, qty: 5 }, { warehouseId: OTHER, qty: 7 }] };
    expect(resolveAllocations(items, MAIN, stock, rows).covered).toBe(false);
  });

  it("si una fila pide más de lo que hay en esa bodega no está cubierto", () => {
    const rows = { [P]: [{ warehouseId: MAIN, qty: 8 }, { warehouseId: OTHER, qty: 2 }] };
    expect(resolveAllocations(items, MAIN, stock, rows).covered).toBe(false);
  });

  it("una fila en 0 no se manda", () => {
    const rows = { [P]: [{ warehouseId: MAIN, qty: 0 }, { warehouseId: OTHER, qty: 10 }] };
    expect(resolveAllocations(items, MAIN, stock, rows).allocations).toEqual([
      { product_id: P, warehouse_id: OTHER, qty: 10 },
    ]);
  });
});
