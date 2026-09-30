import { notFound } from "next/navigation";

import { closePeriod, deletePeriod, recalculatePeriod } from "@/actions/payroll";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { COST_CLASSIFICATIONS } from "@/lib/rrhh/workers";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { type Settlement, SettlementRow } from "./settlement-row";

export const metadata = { title: "Período de nómina · Miel" };

/** S21-05: la nómina de un período — un renglón por trabajador, totales y acciones. */
export default async function PeriodoNominaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") notFound();

  const supabase = await createClient();
  const { data: period } = await supabase
    .from("payroll_periods")
    .select(
      "id, period_start, period_end, status, payroll_settlements(id, days_worked, extra_diurna, extra_nocturna, recargo_nocturno, horas_dominical_festivo, hours_worked, weekly_hours, gross_earnings, total_deductions, net_pay, result, dian_status, dian_consecutive, workers(full_name, worker_type, cost_classification))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!period) notFound();

  const rows: Settlement[] = period.payroll_settlements
    .map((s) => ({
      id: s.id,
      workerName: s.workers?.full_name ?? "—",
      workerType: s.workers?.worker_type ?? "planta",
      days_worked: Number(s.days_worked),
      extra_diurna: Number(s.extra_diurna),
      extra_nocturna: Number(s.extra_nocturna),
      recargo_nocturno: Number(s.recargo_nocturno),
      horas_dominical_festivo: Number(s.horas_dominical_festivo),
      hours_worked: Number(s.hours_worked),
      weekly_hours: Number(s.weekly_hours),
      gross_earnings: Number(s.gross_earnings),
      total_deductions: Number(s.total_deductions),
      net_pay: Number(s.net_pay),
      result: s.result as Settlement["result"],
      dianStatus: s.dian_status,
      dianConsecutive: s.dian_consecutive,
    }))
    .sort((a, b) => a.workerName.localeCompare(b.workerName));
  const editable = period.status === "draft";

  // S21-06: costo para la empresa (devengado + aportes + provisiones) según cómo clasificó a cada
  // trabajador; así entra a Finanzas al cerrar el período. Sin clasificar = gasto fijo.
  const costByClass = new Map<string, number>();
  for (const s of period.payroll_settlements) {
    const r = (s.result ?? {}) as {
      employerContributions?: { totalContributions?: number };
      provisions?: { totalProvisions?: number };
    };
    const cost =
      Number(s.gross_earnings) +
      Number(r.employerContributions?.totalContributions ?? 0) +
      Number(r.provisions?.totalProvisions ?? 0);
    const key = s.workers?.cost_classification ?? "gasto_fijo";
    costByClass.set(key, (costByClass.get(key) ?? 0) + cost);
  }
  const total = (k: "gross_earnings" | "total_deductions" | "net_pay") => rows.reduce((sum, r) => sum + r[k], 0);
  const anyGenerated = rows.some((r) => r.dianStatus === "generated");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Nómina {formatDate(period.period_start)} – {formatDate(period.period_end)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {editable ? "Abierta: puedes ajustar novedades y recalcular." : "Cerrada."}
          </p>
        </div>
        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <form action={recalculatePeriod}>
              <input type="hidden" name="period_id" value={period.id} />
              <Button type="submit" variant="outline">
                Recalcular todo
              </Button>
            </form>
            <form action={closePeriod}>
              <input type="hidden" name="period_id" value={period.id} />
              <Button type="submit">Cerrar período</Button>
            </form>
            {anyGenerated ? null : (
              <form action={deletePeriod}>
                <input type="hidden" name="period_id" value={period.id} />
                <Button type="submit" variant="ghost">
                  Borrar período
                </Button>
              </form>
            )}
          </div>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold tracking-tight">Costo para la empresa</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(COST_CLASSIFICATIONS) as (keyof typeof COST_CLASSIFICATIONS)[]).map((k) => (
              <div key={k} className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">{COST_CLASSIFICATIONS[k]}</p>
                <p className="text-base font-semibold tabular-nums">{formatMoney(costByClass.get(k) ?? 0)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Devengado + aportes + provisiones, según &quot;Su pago es&quot; de cada trabajador (sin
            clasificar cuenta como gasto fijo). Entra a Finanzas al cerrar el período.
          </p>
        </section>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Trabajador</th>
                <th className="px-3 py-2 text-right font-medium">Días / horas</th>
                <th className="px-3 py-2 text-right font-medium">Devengado</th>
                <th className="px-3 py-2 text-right font-medium">Deducciones</th>
                <th className="px-3 py-2 text-right font-medium">Neto a pagar</th>
                <th className="px-3 py-2 text-right font-medium">Nómina electrónica</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <SettlementRow key={s.id} s={s} editable={editable} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="px-3 py-2.5" colSpan={2}>
                  Total
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(total("gross_earnings"))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(total("total_deductions"))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(total("net_pay"))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nadie trabajó en este período. Revisa las fechas de ingreso de tus trabajadores.
        </p>
      )}
    </div>
  );
}
