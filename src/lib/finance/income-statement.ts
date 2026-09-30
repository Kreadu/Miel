import { round2 } from "@/lib/money";

/**
 * S22-02: estado de resultados de un mes a partir de las vistas de Finanzas. `expenses` viene de
 * `monthly_expenses` (ya incluye la nómina clasificada como gasto, categoría "Nómina");
 * `payroll` de `monthly_payroll` (solo se usa la clasificada como costo). La línea de cada gasto
 * la dice su categoría; una categoría desconocida es operativa. S23-01: sin renta anotada en el mes,
 * se estima con la tarifa de la empresa sobre la utilidad antes de impuestos (0 si hay pérdida).
 */
export type IncomeStatementInput = {
  income: number;
  cogs: number;
  payroll: { classification: string | null; labor_cost: number | null }[];
  expenses: { category: string | null; kind: string | null; amount: number | null }[];
  lines: Record<string, string>;
  /** Tarifa de renta de la empresa, en % (tenants.income_tax_rate). */
  incomeTaxRate: number;
};

export function buildIncomeStatement({ income, cogs, payroll, expenses, lines, incomeTaxRate }: IncomeStatementInput) {
  const sumPayroll = (c: string) =>
    payroll.filter((p) => p.classification === c).reduce((s, p) => s + Number(p.labor_cost ?? 0), 0);
  const sumExpenses = (keep: (e: IncomeStatementInput["expenses"][number]) => boolean) =>
    expenses.filter(keep).reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const line = (e: IncomeStatementInput["expenses"][number]) => lines[e.category ?? ""] ?? "operativo";

  const costOfSales = cogs + sumPayroll("costo_fijo") + sumPayroll("costo_variable");
  const grossProfit = income - costOfSales;
  const depreciation = sumExpenses((e) => line(e) === "depreciacion");
  const operatingExpenses = sumExpenses((e) => line(e) === "operativo") + depreciation;
  const ebit = grossProfit - operatingExpenses;
  const financialExpenses = sumExpenses((e) => line(e) === "financiero");
  const preTax = ebit - financialExpenses;
  const recordedTax = sumExpenses((e) => line(e) === "impuesto_renta");
  const incomeTaxEstimated = recordedTax === 0;
  const incomeTax = incomeTaxEstimated ? round2((Math.max(preTax, 0) * incomeTaxRate) / 100) : recordedTax;
  const variableCosts = cogs + sumPayroll("costo_variable") + sumExpenses((e) => e.kind === "variable");

  return {
    income,
    costOfSales,
    grossProfit,
    operatingExpenses,
    ebit,
    depreciation,
    ebitda: ebit + depreciation,
    financialExpenses,
    preTax,
    incomeTax,
    incomeTaxEstimated,
    netProfit: preTax - incomeTax,
    variableCosts,
    contribution: income - variableCosts,
    margin: (value: number) => (income > 0 ? value / income : null),
  };
}

export type IncomeStatement = ReturnType<typeof buildIncomeStatement>;
