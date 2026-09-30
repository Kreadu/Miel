import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAdvisorConfigured } from "@/lib/ai/advisor";
import type { HealthStatus } from "@/lib/finance/health";
import type { IncomeStatement } from "@/lib/finance/income-statement";
import { loadFinance } from "@/lib/finance/load";
import { parseMonthRange } from "@/lib/finance/range";
import { formatDateTime, formatMoney } from "@/lib/format";
import { todayInBogota } from "@/lib/inventory-history";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { AdvisorForm } from "./advisor-form";
import { FiscalForm } from "./fiscal-form";
import { type ChartMonth, ResultsCharts } from "./results-charts";

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

const HEALTH_STYLE: Record<HealthStatus, { label: string; icon: typeof CircleCheck; className: string }> = {
  good: { label: "Bien", icon: CircleCheck, className: "text-success" },
  warning: { label: "Atención", icon: CircleAlert, className: "text-primary" },
  critical: { label: "Crítico", icon: CircleX, className: "text-destructive" },
};

function monthLabel(month: string, style: "long" | "short" = "long"): string {
  const label = new Intl.DateTimeFormat("es-CO", { month: style, year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-15T00:00:00Z`),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function percent(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

/**
 * S22-02/S22-03: estado de resultados del rango elegido con todos los márgenes, análisis gráfico
 * mes a mes, salud de la empresa y asesor con IA. Solo owner/admin.
 */
export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") notFound();

  const range = parseMonthRange(await searchParams, todayInBogota().slice(0, 7));
  const supabase = await createClient();
  const [finance, history] = await Promise.all([
    loadFinance(supabase, active.tenantId, range),
    supabase
      .from("advisor_questions")
      .select("id, question, answer, range_from, range_to, created_at")
      .eq("tenant_id", active.tenantId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const { monthly, total, health, fiscal } = finance;
  const rangeLabel =
    range.from === range.to ? monthLabel(range.from) : `${monthLabel(range.from)} – ${monthLabel(range.to)}`;
  const chartData: ChartMonth[] = monthly.map(({ month, statement: s }) => {
    const m = (v: number) => (s.income > 0 ? Math.round((v / s.income) * 1000) / 10 : null);
    return {
      label: monthLabel(month, "short"),
      income: s.income,
      netProfit: s.netProfit,
      gross: m(s.grossProfit),
      operating: m(s.ebit),
      net: m(s.netProfit),
    };
  });

  const table = (title: string, rows: Row[]) => (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Concepto</th>
              <th className="px-3 py-2 text-right font-medium">{rangeLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((r) => [
              <tr key={r.key} className={r.total ? "border-t border-border font-semibold" : ""}>
                <td className="px-3 py-2">
                  {r.label}
                  {r.key === "incomeTax" && total.incomeTaxEstimated && (
                    <span className="ml-1 text-xs text-muted-foreground">(estimado {fiscal.incomeTaxRate}%)</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{formatMoney(total[r.key])}</td>
              </tr>,
              ...(r.margin
                ? [
                    <tr key={`${r.key}-margin`} className="bg-muted/40">
                      <td className="px-3 py-1.5 pl-6 text-xs font-medium text-primary">{r.margin}</td>
                      <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-primary">
                        {percent(total.margin(total[r.key]))}
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
    <div className="flex max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Estado de resultados</h1>
          <p className="text-sm text-muted-foreground">
            Ventas, costos, gastos y nómina de {rangeLabel.toLowerCase()}, con todos los márgenes.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="desde">Desde</Label>
            <Input id="desde" name="desde" type="month" defaultValue={range.from} className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="hasta">Hasta</Label>
            <Input id="hasta" name="hasta" type="month" defaultValue={range.to} className="w-40" />
          </div>
          <Button type="submit" variant="outline">
            Ver
          </Button>
        </form>
      </div>

      {total.income === 0 && total.netProfit === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aún no hay ventas, gastos ni nómina en este rango. Elige otros meses arriba.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {table("Estado de resultados", ROWS)}
        {table("Margen de contribución", CONTRIBUTION_ROWS)}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">Análisis gráfico</h2>
        <ResultsCharts data={chartData} />
        <details className="rounded-lg border border-border bg-card">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Ver cifras por mes</summary>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Mes</th>
                  <th className="px-3 py-2 text-right font-medium">Ventas</th>
                  <th className="px-3 py-2 text-right font-medium">Utilidad neta</th>
                  <th className="px-3 py-2 text-right font-medium">Margen bruto</th>
                  <th className="px-3 py-2 text-right font-medium">Margen operativo</th>
                  <th className="px-3 py-2 text-right font-medium">Margen neto</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((m) => (
                  <tr key={m.label} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{m.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(m.income)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(m.netProfit)}</td>
                    {[m.gross, m.operating, m.net].map((v, i) => (
                      <td key={i} className="px-3 py-2 text-right tabular-nums">
                        {v === null ? "—" : `${v.toFixed(1)}%`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Salud de la empresa</h2>
          <p className="text-sm text-muted-foreground">{health.summary}</p>
        </div>
        {health.indicators.length > 0 && (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {health.indicators.map((i) => {
              const style = HEALTH_STYLE[i.status];
              const Icon = style.icon;
              return (
                <li key={i.id} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{i.label}</span>
                    <span className={`flex items-center gap-1 text-xs font-medium ${style.className}`}>
                      <Icon className="size-4" aria-hidden />
                      {style.label}
                    </span>
                  </div>
                  <p className="text-lg font-semibold tabular-nums">{i.value}</p>
                  <p className="text-xs text-muted-foreground">{i.detail}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Pregúntale a la IA cómo mejorar</h2>
          <p className="text-sm text-muted-foreground">
            La IA ve las cifras de {rangeLabel.toLowerCase()} y tus productos más vendidos (sin datos de clientes ni
            trabajadores). Sus respuestas son orientación: valida las decisiones importantes con tu contador.
          </p>
        </div>
        <AdvisorForm from={range.from} to={range.to} configured={isAdvisorConfigured()} />
        {(history.data ?? []).length > 0 ? (
          <ul className="flex flex-col gap-4">
            {(history.data ?? []).map((q) => (
              <li key={q.id} className="flex flex-col gap-2 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(q.created_at)} · {q.range_from === q.range_to ? q.range_from : `${q.range_from} a ${q.range_to}`}
                </p>
                <p className="text-sm font-medium">{q.question}</p>
                <p className="text-sm whitespace-pre-wrap">{q.answer}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aún no hay preguntas. Haz la primera arriba.</p>
        )}
      </section>

      <FiscalForm personType={fiscal.personType} incomeTaxRate={fiscal.incomeTaxRate} />

      <p className="text-xs text-muted-foreground">
        Todo sin IVA (se recupera). Ventas incluye los envíos cobrados. La depreciación, los gastos financieros y el
        impuesto de renta se anotan en Gastos con su categoría; sin renta anotada, se muestra la estimada. La nómina
        entra al cerrar cada período, como costo o gasto según la ficha del trabajador.
      </p>
    </div>
  );
}
