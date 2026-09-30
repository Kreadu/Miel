import { describe, expect, it } from "vitest";

import { purchaseLine } from "./line";

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
