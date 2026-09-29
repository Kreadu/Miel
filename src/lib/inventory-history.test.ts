import { describe, expect, it } from "vitest";

import { historyFilters } from "./inventory-history";

const W = "123e4567-e89b-12d3-a456-426614174099";

describe("historyFilters (S19-34)", () => {
  it("por defecto: del 1 del mes a hoy, todas las bodegas", () => {
    expect(historyFilters({}, "2026-09-29")).toEqual({
      from: "2026-09-01",
      to: "2026-09-29",
      warehouseId: null,
    });
  });

  it("respeta fechas y bodega válidas", () => {
    expect(historyFilters({ desde: "2026-01-10", hasta: "2026-02-20", bodega: W }, "2026-09-29")).toEqual({
      from: "2026-01-10",
      to: "2026-02-20",
      warehouseId: W,
    });
  });

  it("ignora valores inválidos y da vuelta un rango invertido", () => {
    expect(historyFilters({ desde: "ayer", hasta: "2026-09-20", bodega: "x" }, "2026-09-29")).toEqual({
      from: "2026-09-01",
      to: "2026-09-20",
      warehouseId: null,
    });
    expect(historyFilters({ desde: "2026-03-01", hasta: "2026-02-01" }, "2026-09-29")).toEqual({
      from: "2026-02-01",
      to: "2026-03-01",
      warehouseId: null,
    });
  });
});
