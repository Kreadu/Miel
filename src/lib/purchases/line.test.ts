import { describe, expect, it } from "vitest";

import { pendingTotals, purchaseLine } from "./line";

describe("purchaseLine (S19-37)", () => {
  it("costo unitario con IVA y costo total de la línea", () => {
    expect(purchaseLine(3, 1000, 19)).toEqual({ unitWithTax: 1190, total: 3570 });
  });

  it("sin IVA el unitario es el costo del proveedor", () => {
    expect(purchaseLine(2, 150.5, 0)).toEqual({ unitWithTax: 150.5, total: 301 });
  });

  it("redondea a 2 decimales como la BD", () => {
    expect(purchaseLine(1, 99.99, 19).unitWithTax).toBe(118.99);
  });
});

describe("total sin redondear el unitario (S23-01)", () => {
  it("el total es qty · costo · (1 + IVA), como create_purchase", () => {
    expect(purchaseLine(3, 99.99, 19).total).toBe(356.96);
  });
});

describe("pendingTotals (factura vs. orden)", () => {
  it("suma lo que falta recibir: subtotal sin IVA, IVA y total", () => {
    expect(
      pendingTotals([
        { qty: 10, received_qty: 4, unit_cost: 1000, tax_rate: 19 },
        { qty: 5, received_qty: 0, unit_cost: 2000, tax_rate: 0 },
        { qty: 3, received_qty: 3, unit_cost: 999, tax_rate: 19 },
      ]),
    ).toEqual({ subtotal: 16000, tax: 1140, total: 17140 });
  });
});
