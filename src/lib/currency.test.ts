import { describe, expect, it } from "vitest";

import { formatMoney, isSupportedCurrency } from "./currency";

describe("isSupportedCurrency", () => {
  it("acepta monedas de la lista soportada", () => {
    expect(isSupportedCurrency("COP")).toBe(true);
    expect(isSupportedCurrency("EUR")).toBe(true);
  });

  it("rechaza códigos no soportados", () => {
    expect(isSupportedCurrency("XYZ")).toBe(false);
    expect(isSupportedCurrency("")).toBe(false);
  });
});

describe("formatMoney", () => {
  it("formatea COP sin decimales cuando no hay centavos", () => {
    expect(formatMoney(25000, "COP")).toContain("25.000");
    expect(formatMoney(25000, "COP")).not.toContain(",");
  });

  it("S23-01: COP con centavos los muestra (igual que el resto de Miel)", () => {
    expect(formatMoney(154.7, "COP")).toContain("154,70");
  });

  it("formatea EUR con decimales", () => {
    expect(formatMoney(25.5, "EUR")).toContain("25,50");
  });
});
