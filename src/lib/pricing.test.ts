import { describe, expect, it } from "vitest";

import { markupFromPrice, priceFromMarkup } from "./pricing";

describe("% de venta sobre el costo (S19-34)", () => {
  it("precio = costo + % de venta", () => {
    expect(priceFromMarkup(1000, 50)).toBe(1500);
    expect(priceFromMarkup(1000, 0)).toBe(1000);
    expect(priceFromMarkup(333, 33.33)).toBe(443.99);
  });

  it("% de venta a partir del precio escrito a mano", () => {
    expect(markupFromPrice(1000, 1500)).toBe(50);
    expect(markupFromPrice(1000, 800)).toBe(-20);
  });

  it("sin costo no hay % posible", () => {
    expect(markupFromPrice(0, 1500)).toBeNull();
  });
});
