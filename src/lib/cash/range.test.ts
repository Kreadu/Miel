import { describe, expect, it } from "vitest";

import { cashRange } from "./range";

describe("cashRange (S18-12)", () => {
  it("sin fechas: solo hoy", () => {
    expect(cashRange({}, "2026-09-30")).toEqual({ from: "2026-09-30", to: "2026-09-30" });
  });
  it("con fechas: el rango, ordenado", () => {
    expect(cashRange({ desde: "2026-09-30", hasta: "2026-09-01" }, "2026-09-30")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });
  it("fechas inválidas: hoy", () => {
    expect(cashRange({ desde: "ayer" }, "2026-09-30")).toEqual({ from: "2026-09-30", to: "2026-09-30" });
  });
});
