import { describe, expect, it } from "vitest";

import { buildIncomeStatement } from "@/lib/finance/income-statement";

import { buildAdvisorContext, topProducts } from "./advisor-context";

describe("topProducts (S22-03)", () => {
  it("suma por producto, ordena por ventas y calcula el margen", () => {
    const rows = [
      { qty: 2, unit_price: 100, discount: 0, unit_cost: 60, products: { name: "Miel 500 g" } },
      { qty: 1, unit_price: 100, discount: 10, unit_cost: 60, products: { name: "Miel 500 g" } },
      { qty: 10, unit_price: 50, discount: 0, unit_cost: 20, products: { name: "Polen" } },
    ];
    expect(topProducts(rows, 10)).toEqual([
      { name: "Polen", qty: 10, sales: 500, margin: 0.6 },
      { name: "Miel 500 g", qty: 3, sales: 290, margin: 1 - 180 / 290 },
    ]);
  });

  it("recorta al límite", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ qty: 1, unit_price: i + 1, discount: 0, unit_cost: 0, products: { name: `P${i}` } }));
    expect(topProducts(rows, 2).map((p) => p.name)).toEqual(["P4", "P3"]);
  });
});

describe("buildAdvisorContext (S22-03)", () => {
  const s = buildIncomeStatement({ income: 1000, cogs: 600, payroll: [], expenses: [], lines: {}, incomeTaxRate: 35 });

  it("incluye rango, meses, balances, salud y productos, sin datos de personas", () => {
    const text = buildAdvisorContext({
      range: { from: "2026-08", to: "2026-09" },
      monthly: [
        { month: "2026-08", statement: s },
        { month: "2026-09", statement: s },
      ],
      total: s,
      balances: { receivable: 100, payable: 50, inventory: 300 },
      health: { summary: "Empresa sana en el rango elegido.", indicators: [] },
      products: [{ name: "Polen", qty: 10, sales: 500, margin: 0.6 }],
    });
    expect(text).toContain("2026-08 a 2026-09");
    expect(text).toContain("2026-09");
    expect(text).toContain("Polen");
    expect(text).toContain("Empresa sana");
    expect(text).toContain("Cuentas por cobrar");
  });
});
