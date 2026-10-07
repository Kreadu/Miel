import { describe, expect, it } from "vitest";

import { storePrice } from "./price";

describe("storePrice (S27-01)", () => {
  it("precio final con descuento e IVA, y el anterior con IVA", () => {
    expect(storePrice(10000, 10, 19)).toEqual({ final: 10710, before: 11900 });
  });
  it("sin descuento no hay precio tachado", () => {
    expect(storePrice(7000, 0, 0)).toEqual({ final: 7000, before: null });
  });
  it("redondea a centavos como las ventas", () => {
    expect(storePrice(3333, 0, 19)).toEqual({ final: 3966.27, before: null });
  });
});
