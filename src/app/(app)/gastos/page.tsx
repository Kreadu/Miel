import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { formatMoney } from "@/lib/format";
import { todayInBogota } from "@/lib/inventory-history";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import type { ExpenseValues } from "./expense-form";
import { ExpenseRow } from "./expense-row";
import { NewExpense } from "./new-expense";

export async function generateMetadata() {
  const t = await getTranslations("expenses");
  return { title: `${t("title")} · Miel` };
}

const SHEETS = {
  fijos: { kind: "fixed", payroll: "gasto_fijo" },
  variables: { kind: "variable", payroll: "gasto_variable" },
} as const;

/** Día calendario en Bogotá ("AAAA-MM-DD") de un timestamp. */
function bogotaDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(iso));
}

/**
 * S22-01: Gastos en dos hojas — fijos y variables. Cada hoja: formulario con categorías ya
 * clasificadas, tabla con Editar/Borrar y total del mes (incluye la nómina clasificada como
 * gasto en RRHH). Solo owner/admin.
 */
export default async function GastosPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") notFound();

  const { tipo } = await searchParams;
  const t = await getTranslations("expenses");
  const sheetKey = tipo === "variables" ? "variables" : "fijos";
  const sheet = SHEETS[sheetKey];
  const today = todayInBogota();
  const month = today.slice(0, 7);

  const supabase = await createClient();
  const [{ data: categories }, { data: suppliers }, { data: expenses }, { data: payroll }] = await Promise.all([
    supabase.from("expense_categories").select("name").eq("kind", sheet.kind).order("name"),
    supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
    supabase
      .from("expenses")
      .select("id, category, description, amount, tax_amount, method, paid_at, supplier_id, suppliers(name)")
      .eq("kind", sheet.kind)
      .order("paid_at", { ascending: false })
      .limit(300),
    supabase.from("monthly_payroll").select("month, labor_cost").eq("classification", sheet.payroll).order("month", { ascending: false }),
  ]);

  const categoryNames = (categories ?? []).map((c) => c.name);
  const rows = (expenses ?? []).map((e) => ({
    values: {
      id: e.id,
      category: e.category,
      description: e.description,
      amount: Number(e.amount),
      tax_amount: Number(e.tax_amount),
      method: e.method as ExpenseValues["method"],
      paid_on: bogotaDay(e.paid_at),
      supplier_id: e.supplier_id,
    } satisfies ExpenseValues,
    supplierName: e.suppliers?.name ?? null,
  }));
  const payrollThisMonth = (payroll ?? [])
    .filter((p) => p.month === month)
    .reduce((s, p) => s + Number(p.labor_cost ?? 0), 0);
  const expensesThisMonth = rows
    .filter((r) => r.values.paid_on.startsWith(month))
    .reduce((s, r) => s + r.values.amount - r.values.tax_amount, 0);

  const tab = (key: keyof typeof SHEETS) =>
    `inline-flex h-10 items-center justify-center rounded-md px-5 text-sm font-medium shadow-sm ${
      key === sheetKey
        ? "bg-primary text-primary-foreground hover:bg-primary/90"
        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
    }`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/gastos?tipo=fijos" className={tab("fijos")}>
            {t("sheets.fijos")}
          </Link>
          <Link href="/gastos?tipo=variables" className={tab("variables")}>
            {t("sheets.variables")}
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">{t(`monthRecorded.${sheetKey}`)}</p>
          <p className="text-base font-semibold tabular-nums">{formatMoney(expensesThisMonth)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">{t("labor")}</p>
          <p className="text-base font-semibold tabular-nums">{formatMoney(payrollThisMonth)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">{t(`monthTotal.${sheetKey}`)}</p>
          <p className="text-base font-semibold tabular-nums">{formatMoney(expensesThisMonth + payrollThisMonth)}</p>
        </div>
      </section>

      <NewExpense
        key={sheetKey}
        kind={sheet.kind}
        categories={categoryNames}
        suppliers={suppliers ?? []}
        today={today}
      />

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("date")}</th>
                <th className="px-3 py-2 font-medium">{t("category")}</th>
                <th className="px-3 py-2 font-medium">{t("description")}</th>
                <th className="px-3 py-2 font-medium">{t("payment")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("amount")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <ExpenseRow
                  key={r.values.id}
                  expense={r.values}
                  supplierName={r.supplierName}
                  kind={sheet.kind}
                  categories={categoryNames}
                  suppliers={suppliers ?? []}
                  today={today}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t(`empty.${sheetKey}`)}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {t("laborNote")}
      </p>
    </div>
  );
}
