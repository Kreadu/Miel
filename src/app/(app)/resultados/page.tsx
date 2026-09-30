import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAdvisorConfigured } from "@/lib/ai/advisor";
import type { HealthIndicator, HealthStatus } from "@/lib/finance/health";
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

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: `${t("resultados")} · Miel` };
}

type Row = { key: Exclude<keyof IncomeStatement, "margin" | "incomeTaxEstimated">; total?: boolean; margin?: boolean };

// Etiquetas en `results.rows.<key>` y `results.margins.<key>`.
const ROWS: Row[] = [
  { key: "income", total: true },
  { key: "costOfSales" },
  { key: "grossProfit", total: true, margin: true },
  { key: "operatingExpenses" },
  { key: "ebit", total: true, margin: true },
  { key: "depreciation" },
  { key: "ebitda", total: true, margin: true },
  { key: "financialExpenses" },
  { key: "preTax", total: true, margin: true },
  { key: "incomeTax" },
  { key: "netProfit", total: true, margin: true },
];

const CONTRIBUTION_ROWS: Row[] = [
  { key: "income", total: true },
  { key: "variableCosts" },
  { key: "contribution", total: true, margin: true },
];

const HEALTH_STYLE: Record<HealthStatus, { icon: typeof CircleCheck; className: string }> = {
  good: { icon: CircleCheck, className: "text-success" },
  warning: { icon: CircleAlert, className: "text-primary" },
  critical: { icon: CircleX, className: "text-destructive" },
};

// Nombres de mes en el idioma de la pantalla (las cifras siguen en formato colombiano, ADR-040).
const INTL_LOCALE: Record<string, string> = { es: "es-CO", en: "en-US", fr: "fr-FR" };

function monthLabel(month: string, locale: string, style: "long" | "short" = "long"): string {
  const label = new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? "es-CO", { month: style, year: "numeric", timeZone: "UTC" }).format(
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
  const t = await getTranslations("results");
  const locale = await getLocale();
  const healthValue = (i: HealthIndicator) =>
    i.value === null
      ? t("health.noDebts")
      : i.id === "liquidity"
        ? t("health.times", { value: i.value.toFixed(2) })
        : `${i.id === "trend" && i.value >= 0 ? "+" : ""}${percent(i.value)}`;
  const healthDetail = (i: HealthIndicator) =>
    i.id === "net"
      ? (i.value ?? 0) < 0
        ? t("health.detail.netLoss")
        : t("health.detail.net", { amount: ((i.value ?? 0) * 100).toFixed(0) })
      : t(`health.detail.${i.id}`);
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
    range.from === range.to
      ? monthLabel(range.from, locale)
      : `${monthLabel(range.from, locale)} – ${monthLabel(range.to, locale)}`;
  const chartData: ChartMonth[] = monthly.map(({ month, statement: s }) => {
    const m = (v: number) => (s.income > 0 ? Math.round((v / s.income) * 1000) / 10 : null);
    return {
      label: monthLabel(month, locale, "short"),
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
              <th className="px-3 py-2 text-left font-medium">{t("concept")}</th>
              <th className="px-3 py-2 text-right font-medium">{rangeLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((r) => [
              <tr key={r.key} className={r.total ? "border-t border-border font-semibold" : ""}>
                <td className="px-3 py-2">
                  {t(`rows.${r.key}`)}
                  {r.key === "incomeTax" && total.incomeTaxEstimated && (
                    <span className="ml-1 text-xs text-muted-foreground">{t("estimated", { rate: fiscal.incomeTaxRate })}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{formatMoney(total[r.key])}</td>
              </tr>,
              ...(r.margin
                ? [
                    <tr key={`${r.key}-margin`} className="bg-muted/40">
                      <td className="px-3 py-1.5 pl-6 text-xs font-medium text-primary">{t(`margins.${r.key}`)}</td>
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
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle", { range: rangeLabel.toLowerCase() })}
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="desde">{t("from")}</Label>
            <Input id="desde" name="desde" type="month" defaultValue={range.from} className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="hasta">{t("to")}</Label>
            <Input id="hasta" name="hasta" type="month" defaultValue={range.to} className="w-40" />
          </div>
          <Button type="submit" variant="outline">
            {t("view")}
          </Button>
        </form>
      </div>

      {total.income === 0 && total.netProfit === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {table(t("statement"), ROWS)}
        {table(t("contributionTitle"), CONTRIBUTION_ROWS)}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">{t("charts.title")}</h2>
        <ResultsCharts data={chartData} />
        <details className="rounded-lg border border-border bg-card">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{t("charts.showFigures")}</summary>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">{t("charts.month")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("charts.sales")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("charts.netProfit")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("charts.gross")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("charts.operating")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("charts.net")}</th>
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
          <h2 className="text-base font-semibold tracking-tight">{t("health.title")}</h2>
          <p className="text-sm text-muted-foreground">{t(`health.summary.${health.summary.kind}`, { count: health.summary.count })}</p>
        </div>
        {health.indicators.length > 0 && (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {health.indicators.map((i) => {
              const style = HEALTH_STYLE[i.status];
              const Icon = style.icon;
              return (
                <li key={i.id} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{t(`health.label.${i.id}`)}</span>
                    <span className={`flex items-center gap-1 text-xs font-medium ${style.className}`}>
                      <Icon className="size-4" aria-hidden />
                      {t(`health.status.${i.status}`)}
                    </span>
                  </div>
                  <p className="text-lg font-semibold tabular-nums">{healthValue(i)}</p>
                  <p className="text-xs text-muted-foreground">{healthDetail(i)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{t("advisor.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("advisor.help", { range: rangeLabel.toLowerCase() })}
          </p>
        </div>
        <AdvisorForm from={range.from} to={range.to} configured={isAdvisorConfigured()} />
        {(history.data ?? []).length > 0 ? (
          <ul className="flex flex-col gap-4">
            {(history.data ?? []).map((q) => (
              <li key={q.id} className="flex flex-col gap-2 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(q.created_at)} · {q.range_from === q.range_to ? q.range_from : t("advisor.rangeTo", { from: q.range_from, to: q.range_to })}
                </p>
                <p className="text-sm font-medium">{q.question}</p>
                <p className="text-sm whitespace-pre-wrap">{q.answer}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("advisor.empty")}</p>
        )}
      </section>

      <FiscalForm personType={fiscal.personType} incomeTaxRate={fiscal.incomeTaxRate} />

      <p className="text-xs text-muted-foreground">
        {t("footnote")}
      </p>
    </div>
  );
}
