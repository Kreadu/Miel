import { FileCog, HeartPulse } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { formatDate, formatMoney } from "@/lib/format";
import { todayInBogota } from "@/lib/inventory-history";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { PeriodForm } from "./period-form";

export async function generateMetadata() {
  const t = await getTranslations("rrhh.payroll");
  return { title: `${t("title")} · Miel` };
}

const LINK_CLASS =
  "inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80";

/** Último día del mes de una fecha "AAAA-MM-DD". */
function monthEnd(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** S21-05: períodos de nómina — crear, ver y generar la nómina electrónica. */
export default async function NominaPage() {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") notFound();

  const supabase = await createClient();
  const [{ data: periods }, { data: settings }] = await Promise.all([
    supabase
      .from("payroll_periods")
      .select("id, period_start, period_end, status, payroll_settlements(net_pay, dian_status)")
      .order("period_start", { ascending: false }),
    supabase.from("dian_settings").select("tenant_id").maybeSingle(),
  ]);
  const today = todayInBogota();
  const t = await getTranslations("rrhh");

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("payroll.title")}</h1>
          <p className="text-sm text-muted-foreground">{active.tenantName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/equipo/licencias" className={LINK_CLASS}>
            <HeartPulse className="mr-2 h-4 w-4" />
            {t("links.leaves")}
          </Link>
          <Link href="/equipo/nomina/dian" className={LINK_CLASS}>
            <FileCog className="mr-2 h-4 w-4" />
            {t("payroll.dianData")}
          </Link>
        </div>
      </div>

      {settings ? null : (
        <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          {t.rich("payroll.dianMissing", {
            link: (chunks) => (
              <Link href="/equipo/nomina/dian" className="font-medium text-foreground underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </p>
      )}

      <PeriodForm defaultStart={`${today.slice(0, 8)}01`} defaultEnd={monthEnd(today)} />

      {periods && periods.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("payroll.period")}</th>
                <th className="px-3 py-2 font-medium">{t("payroll.status")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("payroll.workers")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("payroll.dian")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("payroll.totalToPay")}</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                const rows = p.payroll_settlements;
                const net = rows.reduce((s, r) => s + Number(r.net_pay), 0);
                const generated = rows.filter((r) => r.dian_status === "generated").length;
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-3 py-2.5 font-medium">
                      <Link href={`/equipo/nomina/${p.id}`} className="underline-offset-4 hover:underline">
                        {formatDate(p.period_start)} – {formatDate(p.period_end)}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.status === "closed" ? t("payroll.closed") : t("payroll.open")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{rows.length}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {generated}/{rows.length}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatMoney(net)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t("payroll.empty")}
        </p>
      )}
    </div>
  );
}
