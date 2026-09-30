import type { createClient } from "@/lib/supabase/server";

import { assessHealth } from "./health";
import { buildIncomeStatement, type IncomeStatement } from "./income-statement";
import { monthRange } from "./range";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * S22-03: estado de resultados mes a mes y total del rango, balances de hoy y salud, de la empresa
 * activa (filtro explícito: un dueño puede administrar varias). Lo usan la página de Resultados y
 * el asesor con IA, así ambos ven exactamente las mismas cifras.
 */
export async function loadFinance(supabase: Supabase, tenantId: string, range: { from: string; to: string }) {
  const months = monthRange(range.from, range.to);
  const [pnl, payroll, expenses, categories, tenant, metrics] = await Promise.all([
    supabase.from("monthly_pnl").select("month, income, cogs").eq("tenant_id", tenantId).in("month", months),
    supabase.from("monthly_payroll").select("month, classification, labor_cost").eq("tenant_id", tenantId).in("month", months),
    supabase.from("monthly_expenses").select("month, category, kind, amount").eq("tenant_id", tenantId).in("month", months),
    supabase.from("expense_categories").select("name, pnl_line").eq("tenant_id", tenantId),
    supabase.from("tenants").select("person_type, income_tax_rate").eq("id", tenantId).single(),
    supabase
      .from("dashboard_metrics")
      .select("total_receivable, total_payable, inventory_value")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);
  for (const res of [pnl, payroll, expenses, categories, tenant, metrics]) if (res.error) throw res.error;

  const incomeTaxRate = Number(tenant.data?.income_tax_rate ?? 35);
  const lines = Object.fromEntries((categories.data ?? []).map((c) => [c.name, c.pnl_line]));
  const inMonths = (keep: (m: string | null) => boolean) => ({
    income: (pnl.data ?? []).filter((r) => keep(r.month)).reduce((s, r) => s + Number(r.income ?? 0), 0),
    cogs: (pnl.data ?? []).filter((r) => keep(r.month)).reduce((s, r) => s + Number(r.cogs ?? 0), 0),
    payroll: (payroll.data ?? []).filter((r) => keep(r.month)),
    expenses: (expenses.data ?? []).filter((r) => keep(r.month)),
    lines,
    incomeTaxRate,
  });

  const monthly: { month: string; statement: IncomeStatement }[] = months.map((m) => ({
    month: m,
    statement: buildIncomeStatement(inMonths((x) => x === m)),
  }));
  const total = buildIncomeStatement(inMonths(() => true));
  const balances = {
    receivable: Number(metrics.data?.total_receivable ?? 0),
    payable: Number(metrics.data?.total_payable ?? 0),
    inventory: Number(metrics.data?.inventory_value ?? 0),
  };
  const health = assessHealth({ monthly: monthly.map((m) => m.statement), total, ...balances });

  return {
    monthly,
    total,
    balances,
    health,
    fiscal: { personType: tenant.data?.person_type ?? "juridica", incomeTaxRate },
  };
}

/** Límites del rango en hora de Bogotá, para filtrar timestamps (`issued_at`). */
export function rangeBounds(range: { from: string; to: string }): { start: string; end: string } {
  const [y, m] = range.to.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start: `${range.from}-01T00:00:00-05:00`, end: `${next}-01T00:00:00-05:00` };
}
