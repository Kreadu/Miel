import { describe, expect, it } from "vitest";

import { saleLine } from "./line";

describe("saleLine (S23-01)", () => {
  it("IVA redondeado por línea sobre el neto con descuento", () => {
    expect(saleLine(3, 33.33, 10, 19)).toEqual({ net: 89.99, tax: 17.1 });
  });

  it("sin descuento ni IVA", () => {
    expect(saleLine(2, 1000, 0, 0)).toEqual({ net: 2000, tax: 0 });
  });
});
