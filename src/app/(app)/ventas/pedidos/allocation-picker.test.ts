import { describe, expect, it } from "vitest";

import { canUseWarehouse, resolveAllocations } from "./allocation-picker";

const P = "p1";
const HOME = "cinecultivo";
const OTHER = "kreadu";
const items = [{ productId: P, name: "Miel", qty: 10 }];

describe("resolveAllocations (S18-10: asignar por bodega y aceptar)", () => {
  it("nada asignado por defecto: no está listo", () => {
    expect(resolveAllocations(items, { assignments: {}, accepted: {} })).toEqual({ covered: false, allocations: [] });
  });

  it("5 + 5 asignados pero sin aceptar: no está listo", () => {
    const assignments = { [P]: [{ warehouseId: HOME, qty: 5 }, { warehouseId: OTHER, qty: 5 }] };
    expect(resolveAllocations(items, { assignments, accepted: {} }).covered).toBe(false);
  });

  it("5 + 5 aceptado: listo, con el reparto", () => {
    const assignments = { [P]: [{ warehouseId: HOME, qty: 5 }, { warehouseId: OTHER, qty: 5 }] };
    expect(resolveAllocations(items, { assignments, accepted: { [P]: true } })).toEqual({
      covered: true,
      allocations: [
        { product_id: P, warehouse_id: HOME, qty: 5 },
        { product_id: P, warehouse_id: OTHER, qty: 5 },
      ],
    });
  });

  it("aceptado pero sin sumar el total (p. ej. cambió la cantidad): no está listo", () => {
    const assignments = { [P]: [{ warehouseId: HOME, qty: 5 }] };
    expect(resolveAllocations(items, { assignments, accepted: { [P]: true } }).covered).toBe(false);
  });
});

describe("canUseWarehouse", () => {
  it("la bodega propia siempre; otra solo si presta stock", () => {
    expect(canUseWarehouse({ id: HOME, name: "C", lendsStock: false }, HOME)).toBe(true);
    expect(canUseWarehouse({ id: OTHER, name: "K", lendsStock: false }, HOME)).toBe(false);
    expect(canUseWarehouse({ id: OTHER, name: "K", lendsStock: true }, HOME)).toBe(true);
  });
});
