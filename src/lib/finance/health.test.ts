import { describe, expect, it } from "vitest";

import { assessHealth } from "./health";
import { buildIncomeStatement } from "./income-statement";

const month = (income: number, cogs: number, opex = 0) =>
  buildIncomeStatement({
    income,
    cogs,
    payroll: [],
    expenses: opex ? [{ category: "Arriendo", kind: "fixed", amount: opex }] : [],
    lines: {},
    incomeTaxRate: 0,
  });

const byId = (h: ReturnType<typeof assessHealth>, id: string) => h.indicators.find((i) => i.id === id)!;

describe("assessHealth (S22-03)", () => {
  it("empresa sana: todo bien", () => {
    const monthly = [month(1000, 500, 200), month(1100, 550, 200)];
    const h = assessHealth({ monthly, total: month(2100, 1050, 400), receivable: 300, payable: 100, inventory: 500 });
    expect(h.indicators.every((i) => i.status === "good")).toBe(true);
    expect(h.summary).toMatch(/sana/i);
  });

  it("umbrales: margen neto negativo es crítico; margen bruto 20 % es atención", () => {
    const total = month(1000, 800, 300);
    const h = assessHealth({ monthly: [total], total, receivable: 0, payable: 0, inventory: 0 });
    expect(byId(h, "net").status).toBe("critical");
    expect(byId(h, "gross").status).toBe("warning");
  });

  it("tendencia: último mes 20 % bajo el promedio anterior es crítico", () => {
    const monthly = [month(1000, 500), month(1000, 500), month(800, 400)];
    const h = assessHealth({ monthly, total: month(2800, 1400), receivable: 0, payable: 0, inventory: 0 });
    expect(byId(h, "trend").status).toBe("critical");
  });

  it("liquidez: (cartera + inventario) ÷ por pagar < 1 es crítico; sin deudas es bien", () => {
    const t = month(1000, 500);
    expect(byId(assessHealth({ monthly: [t], total: t, receivable: 100, payable: 500, inventory: 200 }), "liquidity").status).toBe("critical");
    expect(byId(assessHealth({ monthly: [t], total: t, receivable: 0, payable: 0, inventory: 0 }), "liquidity").status).toBe("good");
  });

  it("sin ventas en el rango: sin datos", () => {
    const t = month(0, 0);
    const h = assessHealth({ monthly: [t], total: t, receivable: 0, payable: 0, inventory: 0 });
    expect(h.indicators).toEqual([]);
    expect(h.summary).toMatch(/sin datos/i);
  });
});
