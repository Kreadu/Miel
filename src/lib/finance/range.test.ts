import { describe, expect, it } from "vitest";

import { monthRange, parseMonthRange } from "./range";

describe("monthRange (S22-03)", () => {
  it("lista los meses de desde a hasta, cruzando años", () => {
    expect(monthRange("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("parseMonthRange (S22-03)", () => {
  it("por defecto, los últimos 6 meses hasta el actual", () => {
    expect(parseMonthRange({}, "2026-09")).toEqual({ from: "2026-04", to: "2026-09" });
  });

  it("respeta un rango válido", () => {
    expect(parseMonthRange({ desde: "2026-01", hasta: "2026-03" }, "2026-09")).toEqual({ from: "2026-01", to: "2026-03" });
  });

  it("desde > hasta o texto inválido → por defecto", () => {
    expect(parseMonthRange({ desde: "2026-05", hasta: "2026-03" }, "2026-09")).toEqual({ from: "2026-04", to: "2026-09" });
    expect(parseMonthRange({ desde: "hola", hasta: "2026-03" }, "2026-09")).toEqual({ from: "2026-04", to: "2026-09" });
  });

  it("más de 24 meses → se recorta a los 24 que terminan en hasta", () => {
    expect(parseMonthRange({ desde: "2020-01", hasta: "2026-09" }, "2026-09")).toEqual({ from: "2024-10", to: "2026-09" });
  });
});
