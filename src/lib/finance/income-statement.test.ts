import { describe, expect, it } from "vitest";

import { buildIncomeStatement } from "./income-statement";

const lines = {
  Arriendo: "operativo",
  "Depreciación y amortización": "depreciacion",
  "Intereses y gastos financieros": "financiero",
  "Impuesto de renta": "impuesto_renta",
};

describe("buildIncomeStatement (S22-02)", () => {
  const s = buildIncomeStatement({
    income: 1000,
    cogs: 500,
    payroll: [
      { classification: "costo_fijo", labor_cost: 60 },
      { classification: "costo_variable", labor_cost: 40 },
    ],
    expenses: [
      { category: "Arriendo", kind: "fixed", amount: 100 },
      { category: "Nómina", kind: "variable", amount: 50 },
      { category: "Depreciación y amortización", kind: "fixed", amount: 30 },
      { category: "Intereses y gastos financieros", kind: "fixed", amount: 20 },
      { category: "Impuesto de renta", kind: "fixed", amount: 10 },
      { category: "Algo viejo", kind: "variable", amount: 20 },
    ],
    lines,
    incomeTaxRate: 35,
  });

  it("utilidad bruta = ventas − (costo de lo vendido + nómina de costo)", () => {
    expect(s.costOfSales).toBe(600);
    expect(s.grossProfit).toBe(400);
  });

  it("EBIT descuenta gastos operativos incluida depreciación y nómina gasto; categoría desconocida = operativa", () => {
    expect(s.operatingExpenses).toBe(200);
    expect(s.ebit).toBe(200);
  });

  it("EBITDA = EBIT + depreciación", () => {
    expect(s.depreciation).toBe(30);
    expect(s.ebitda).toBe(230);
  });

  it("antes de impuestos y neta", () => {
    expect(s.financialExpenses).toBe(20);
    expect(s.preTax).toBe(180);
    expect(s.incomeTax).toBe(10);
    expect(s.netProfit).toBe(170);
  });

  it("margen de contribución = ventas − costos y gastos variables", () => {
    // 500 costo vendido + 40 nómina costo variable + 50 nómina gasto variable + 20 variable
    expect(s.variableCosts).toBe(610);
    expect(s.contribution).toBe(390);
  });

  it("márgenes sobre ventas; sin ventas, null", () => {
    expect(s.margin(s.netProfit)).toBeCloseTo(0.17);
    const empty = buildIncomeStatement({ income: 0, cogs: 0, payroll: [], expenses: [], lines: {}, incomeTaxRate: 35 });
    expect(empty.margin(empty.netProfit)).toBeNull();
  });

  it("S23-01: sin renta anotada, la estima con la tarifa sobre la utilidad antes de impuestos", () => {
    const base = { income: 1000, cogs: 600, payroll: [], lines, incomeTaxRate: 35 };
    const est = buildIncomeStatement({ ...base, expenses: [] });
    expect(est.incomeTaxEstimated).toBe(true);
    expect(est.incomeTax).toBe(140);
    expect(est.netProfit).toBe(260);
    expect(s.incomeTaxEstimated).toBe(false);
  });

  it("S23-01: con pérdida la renta estimada es 0", () => {
    const loss = buildIncomeStatement({ income: 100, cogs: 600, payroll: [], expenses: [], lines, incomeTaxRate: 35 });
    expect(loss.incomeTax).toBe(0);
  });
});
