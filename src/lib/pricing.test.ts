import { describe, expect, it } from "vitest";

import { markupFromPrice, priceFromMarkup, receiptPricePreview } from "./pricing";

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

describe("precio al recibir con otro costo (S28-02)", () => {
  it("mismo % sobre el nuevo costo promedio, redondeado al peso", () => {
    // 20 a 1.000 + 10 a 1.200 → 1.066,67; 1.500 × 1.066,67 / 1.000 = 1.600
    expect(receiptPricePreview({ stock: 20, cost: 1000, price: 1500, qty: 10, unitCost: 1200 })).toEqual({
      cost: 1066.67,
      price: 1600,
    });
  });

  it("costo igual: el precio no cambia", () => {
    expect(receiptPricePreview({ stock: 10, cost: 1000, price: 1500, qty: 5, unitCost: 1000 }).price).toBe(1500);
  });

  it("sin costo anterior o sin precio: el precio no se toca", () => {
    expect(receiptPricePreview({ stock: 0, cost: 0, price: 800, qty: 1, unitCost: 500 }).price).toBe(800);
    expect(receiptPricePreview({ stock: 5, cost: 1000, price: 0, qty: 1, unitCost: 2000 }).price).toBe(0);
  });

  it("sin stock, el costo nuevo es el de la factura", () => {
    expect(receiptPricePreview({ stock: 0, cost: 1000, price: 1500, qty: 4, unitCost: 1100 })).toEqual({
      cost: 1100,
      price: 1650,
    });
  });
});
