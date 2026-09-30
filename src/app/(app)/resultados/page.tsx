import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildIncomeStatement, type IncomeStatement } from "@/lib/finance/income-statement";
import { formatMoney } from "@/lib/format";
import { todayInBogota } from "@/lib/inventory-history";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { FiscalForm } from "./fiscal-form";

export const metadata = { title: "Resultados · Miel" };

type Row = { label: string; key: Exclude<keyof IncomeStatement, "margin" | "incomeTaxEstimated">; total?: boolean; margin?: string };

const ROWS: Row[] = [
  { label: "Ingresos / Ventas", key: "income", total: true },
  { label: "(−) Costo de ventas", key: "costOfSales" },
  { label: "= Utilidad bruta", key: "grossProfit", total: true, margin: "Margen bruto" },
  { label: "(−) Gastos operativos", key: "operatingExpenses" },
  { label: "= Utilidad operativa / EBIT", key: "ebit", total: true, margin: "Margen operativo / EBIT" },
  { label: "(+) Depreciación y amortización", key: "depreciation" },
  { label: "= EBITDA", key: "ebitda", total: true, margin: "Margen EBITDA" },
  { label: "(−) Gastos financieros y otros gastos", key: "financialExpenses" },
  { label: "= Utilidad antes de impuestos", key: "preTax", total: true, margin: "Margen antes de impuestos" },
  { label: "(−) Impuesto de renta", key: "incomeTax" },
  { label: "= Utilidad neta", key: "netProfit", total: true, margin: "Margen neto" },
];

const CONTRIBUTION_ROWS: Row[] = [
  { label: "Ingresos / Ventas", key: "income", total: true },
  { label: "(−) Costos y gastos variables", key: "variableCosts" },
  { label: "= Margen de contribución", key: "contribution", total: true, margin: "Margen de contribución" },
];

function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const label = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-15T00:00:00Z`),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function percent(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

/**
 * S22-02: estado de resultados del mes con todos los márgenes, comparado con el mes anterior.
 * Solo owner/admin (las vistas de Finanzas ya lo restringen en la base).
 */
export default async function ResultadosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") notFound();

  const { mes } = await searchParams;
  const month = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : todayInBogota().slice(0, 7);
  const prev = previousMonth(month);

  const supabase = await createClient();
  const [pnl, payroll, expenses, categories, tenant] = await Promise.all([
    supabase.from("monthly_pnl").select("month, income, cogs").in("month", [month, prev]),
    supabase.from("monthly_payroll").select("month, classification, labor_cost").in("month", [month, prev]),
    supabase.from("monthly_expenses").select("month, category, kind, amount").in("month", [month, prev]),
    supabase.from("expense_categories").select("name, pnl_line"),
    supabase.from("tenants").select("person_type, income_tax_rate").eq("id", active.tenantId).single(),
  ]);
  for (const res of [pnl, payroll, expenses, categories, tenant]) if (res.error) throw res.error;
  const incomeTaxRate = Number(tenant.data?.income_tax_rate ?? 35);

  const lines = Object.fromEntries((categories.data ?? []).map((c) => [c.name, c.pnl_line]));
  const statementFor = (m: string) => {
    const row = (pnl.data ?? []).find((r) => r.month === m);
    return buildIncomeStatement({
      income: Number(row?.income ?? 0),
      cogs: Number(row?.cogs ?? 0),
      payroll: (payroll.data ?? []).filter((r) => r.month === m),
      expenses: (expenses.data ?? []).filter((r) => r.month === m),
      lines,
      incomeTaxRate,
    });
  };
  const current = statementFor(month);
  const previous = statementFor(prev);
  const empty = [current, previous].every((s) => s.income === 0 && s.netProfit === 0);

  const table = (title: string, rows: Row[]) => (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Concepto</th>
              <th className="px-3 py-2 text-right font-medium">{monthLabel(month)}</th>
              <th className="px-3 py-2 text-right font-medium">{monthLabel(prev)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((r) => [
              <tr key={r.key} className={r.total ? "border-t border-border font-semibold" : ""}>
                <td className="px-3 py-2">
                  {r.label}
                  {r.key === "incomeTax" && current.incomeTaxEstimated && (
                    <span className="ml-1 text-xs text-muted-foreground">(estimado {incomeTaxRate}%)</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{formatMoney(current[r.key])}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-muted-foreground">
                  {formatMoney(previous[r.key])}
                </td>
              </tr>,
              ...(r.margin
                ? [
                    <tr key={`${r.key}-margin`} className="bg-muted/40">
                      <td className="px-3 py-1.5 pl-6 text-xs font-medium text-primary">{r.margin}</td>
                      <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-primary">
                        {percent(current.margin(current[r.key]))}
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                        {percent(previous.margin(previous[r.key]))}
                      </td>
                    </tr>,
                  ]
                : []),
            ])}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Estado de resultados</h1>
          <p className="text-sm text-muted-foreground">Ventas, costos, gastos y nómina del mes, con todos los márgenes.</p>
        </div>
        <form className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="mes">Mes</Label>
            <Input id="mes" name="mes" type="month" defaultValue={month} className="w-44" />
          </div>
          <Button type="submit" variant="outline">
            Ver
          </Button>
        </form>
      </div>

      {empty && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aún no hay ventas, gastos ni nómina en {monthLabel(month).toLowerCase()} ni en el mes anterior.
        </p>
      )}

      {table("Estado de resultados", ROWS)}
      {table("Margen de contribución", CONTRIBUTION_ROWS)}

      <FiscalForm personType={tenant.data?.person_type ?? "juridica"} incomeTaxRate={incomeTaxRate} />

      <p className="text-xs text-muted-foreground">
        Todo sin IVA (se recupera). Ventas incluye los envíos cobrados. La depreciación, los gastos financieros y
        el impuesto de renta se anotan en Gastos con su categoría; sin renta anotada, se muestra la estimada. La
        nómina entra al cerrar cada período, como costo o gasto según la ficha del trabajador.
      </p>
    </div>
  );
}
