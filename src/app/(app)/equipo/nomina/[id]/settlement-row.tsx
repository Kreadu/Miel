"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { generateDian, updateSettlement } from "@/actions/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import type { ColombiaPayrollResult } from "@/lib/rrhh/types/payroll";

export type Settlement = {
  id: string;
  workerName: string;
  workerType: string;
  days_worked: number;
  extra_diurna: number;
  extra_nocturna: number;
  recargo_nocturno: number;
  horas_dominical_festivo: number;
  hours_worked: number;
  weekly_hours: number;
  gross_earnings: number;
  total_deductions: number;
  net_pay: number;
  result: Partial<ColombiaPayrollResult> & { error?: string };
  dianStatus: string;
  dianConsecutive: number | null;
};

// Etiquetas en `rrhh.payroll.fields.<name>`.
const MONTHLY_FIELDS = ["days_worked", "extra_diurna", "extra_nocturna", "recargo_nocturno", "horas_dominical_festivo"] as const;
const HOURLY_FIELDS = ["hours_worked", "weekly_hours"] as const;

function Line({ label, value, strong }: { label: string; value: number | undefined; strong?: boolean }) {
  if (!value) return null;
  return (
    <div className={`flex justify-between gap-4 ${strong ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatMoney(value)}</span>
    </div>
  );
}

/** S21-05: una fila de la nómina: resumen, novedades editables, desglose y nómina electrónica. */
export function SettlementRow({ s, editable }: { s: Settlement; editable: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateSettlement, null);
  const [dianState, dianAction, dianPending] = useActionState(generateDian, null);
  const t = useTranslations();
  const tp = useTranslations("rrhh.payroll");
  const hourly = s.workerType === "por_horas";
  const fields = hourly ? HOURLY_FIELDS : MONTHLY_FIELDS;
  const r = s.result;
  const locked = !editable || s.dianStatus === "generated";

  return (
    <>
      <tr className="border-b border-border">
        <td className="px-3 py-2.5">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 font-medium"
          >
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            {s.workerName}
          </button>
          {r.error ? <p className="mt-1 text-xs text-destructive">{r.error}</p> : null}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums">
          {hourly ? tp("hoursShort", { value: s.hours_worked }) : tp("daysShort", { value: s.days_worked })}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(s.gross_earnings)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(s.total_deductions)}</td>
        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatMoney(s.net_pay)}</td>
        <td className="px-3 py-2.5 text-right">
          {s.dianStatus === "generated" ? (
            <a
              href={`/equipo/nomina/xml/${s.id}`}
              className="text-xs font-medium underline underline-offset-4"
            >
              XML NE{String(s.dianConsecutive).padStart(8, "0")}
            </a>
          ) : (
            <form action={dianAction}>
              <input type="hidden" name="settlement_id" value={s.id} />
              <Button type="submit" size="sm" variant="outline" disabled={dianPending || !!r.error}>
                {dianPending ? tp("generating") : tp("generateDian")}
              </Button>
            </form>
          )}
          {dianState && !dianState.ok ? (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {t(dianState.error)}
            </p>
          ) : null}
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-border bg-muted/30">
          <td colSpan={6} className="px-3 py-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <form action={action} className="flex flex-col gap-3">
                <input type="hidden" name="id" value={s.id} />
                <p className="text-sm font-medium">{tp("novelties")}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {fields.map((name) => (
                    <div key={name} className="flex flex-col gap-1.5">
                      <Label htmlFor={`${s.id}-${name}`} className="text-xs">
                        {tp(`fields.${name}`)}
                      </Label>
                      <Input
                        id={`${s.id}-${name}`}
                        name={name}
                        type="number"
                        min={0}
                        step="0.5"
                        disabled={locked}
                        defaultValue={s[name]}
                        className="text-right"
                      />
                    </div>
                  ))}
                </div>
                {locked ? null : (
                  <div>
                    <Button type="submit" size="sm" disabled={pending}>
                      {pending ? tp("recalculating") : tp("saveAndRecalculate")}
                    </Button>
                  </div>
                )}
                {state && !state.ok ? (
                  <p role="alert" className="text-xs text-destructive">
                    {t(state.error)}
                  </p>
                ) : null}
              </form>

              {r.error ? null : (
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">{tp("breakdown.earnings")}</p>
                    <Line label={tp("breakdown.salary")} value={r.baseSalaryEarned} />
                    <Line label={tp("breakdown.transport")} value={r.earnedAuxTransporte} />
                    <Line label={tp("breakdown.overtime")} value={r.overtimeTotal} />
                    <Line label={tp("breakdown.leaves")} value={r.leaveValue} />
                    <Line label={tp("breakdown.totalEarnings")} value={r.grossEarnings} strong />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">{tp("breakdown.deductions")}</p>
                    <Line label={tp("breakdown.health")} value={r.employeeDeductions?.health4pct} />
                    <Line label={tp("breakdown.pension")} value={r.employeeDeductions?.pension4pct} />
                    <Line label={tp("breakdown.solidarity")} value={r.employeeDeductions?.fspValue} />
                    <Line label={tp("breakdown.withholding")} value={r.employeeDeductions?.retencionFuente} />
                    <Line label={tp("breakdown.totalDeductions")} value={r.employeeDeductions?.totalDeductions} strong />
                  </div>
                  <Line label={tp("breakdown.net")} value={r.netPay} strong />
                  <div className="flex flex-col gap-1 text-muted-foreground">
                    <p className="font-medium text-foreground">{tp("breakdown.companyCost")}</p>
                    <Line label={tp("breakdown.contributions")} value={r.employerContributions?.totalContributions} />
                    <Line label={tp("breakdown.provisions")} value={r.provisions?.totalProvisions} />
                  </div>
                  {r.complianceNotes?.length ? (
                    <ul className="list-disc pl-5 text-xs text-muted-foreground">
                      {r.complianceNotes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
