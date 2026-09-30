import type { HealthId, HealthIndicator, HealthSummary } from "@/lib/finance/health";
import type { IncomeStatement } from "@/lib/finance/income-statement";

/**
 * S22-03: datos que recibe el asesor con IA, armados en el servidor desde la BD del rango elegido.
 * Solo cifras agregadas y nombres de productos (sin clientes, trabajadores ni salarios).
 */
export type ProductSummary = { name: string; qty: number; sales: number; margin: number };

type SaleItemRow = {
  qty: number;
  unit_price: number;
  discount: number;
  unit_cost: number | null;
  products: { name: string } | null;
};

/** Productos con más ventas (sin IVA) en el rango, con su margen bruto. */
export function topProducts(rows: SaleItemRow[], limit: number): ProductSummary[] {
  const byName = new Map<string, { qty: number; sales: number; cost: number }>();
  for (const r of rows) {
    const name = r.products?.name ?? "Sin nombre";
    const acc = byName.get(name) ?? { qty: 0, sales: 0, cost: 0 };
    acc.qty += Number(r.qty);
    acc.sales += Number(r.qty) * Number(r.unit_price) - Number(r.discount);
    acc.cost += Number(r.qty) * Number(r.unit_cost ?? 0);
    byName.set(name, acc);
  }
  return [...byName]
    .map(([name, a]) => ({ name, qty: a.qty, sales: a.sales, margin: a.sales > 0 ? 1 - a.cost / a.sales : 0 }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, limit);
}

const money = (n: number) => Math.round(n).toLocaleString("es-CO");
const pct = (n: number, base: number) => (base > 0 ? `${((n / base) * 100).toFixed(1)}%` : "—");

function statementLine(label: string, s: IncomeStatement): string {
  return [
    label,
    `ventas ${money(s.income)}`,
    `costo de ventas ${money(s.costOfSales)}`,
    `utilidad bruta ${money(s.grossProfit)} (${pct(s.grossProfit, s.income)})`,
    `gastos operativos ${money(s.operatingExpenses)}`,
    `EBIT ${money(s.ebit)} (${pct(s.ebit, s.income)})`,
    `EBITDA ${money(s.ebitda)} (${pct(s.ebitda, s.income)})`,
    `gastos financieros ${money(s.financialExpenses)}`,
    `impuesto de renta ${money(s.incomeTax)}${s.incomeTaxEstimated ? " (estimado)" : ""}`,
    `utilidad neta ${money(s.netProfit)} (${pct(s.netProfit, s.income)})`,
    `margen de contribución ${pct(s.contribution, s.income)}`,
  ].join(" | ");
}

// El bloque de datos para la IA va siempre en español (interno); la respuesta sale en el idioma
// del usuario (S20-06, `advisorSystem`).
const HEALTH_LABEL: Record<HealthId, string> = {
  net: "Rentabilidad (margen neto)",
  gross: "Margen bruto",
  operating: "Margen operativo",
  trend: "Tendencia de ventas (último mes vs. promedio anterior)",
  liquidity: "Liquidez ((cartera + inventario) ÷ por pagar)",
};

function healthSummary(s: HealthSummary): string {
  if (s.kind === "noData") return "Sin datos suficientes: no hay ventas en el rango elegido.";
  if (s.kind === "critical") return `Atención urgente: ${s.count} indicador(es) en rojo.`;
  if (s.kind === "warning") return `Empresa estable, con ${s.count} punto(s) por mejorar.`;
  return "Empresa sana en el rango elegido.";
}

function healthValue(i: HealthIndicator): string {
  if (i.value === null) return "sin deudas";
  return i.id === "liquidity" ? `${i.value.toFixed(2)} veces` : `${(i.value * 100).toFixed(1)}%`;
}

export function buildAdvisorContext({
  range,
  monthly,
  total,
  balances,
  health,
  products,
}: {
  range: { from: string; to: string };
  monthly: { month: string; statement: IncomeStatement }[];
  total: IncomeStatement;
  balances: { receivable: number; payable: number; inventory: number };
  health: { summary: HealthSummary; indicators: HealthIndicator[] };
  products: ProductSummary[];
}): string {
  return [
    `Rango: ${range.from} a ${range.to}. Moneda: pesos colombianos (COP), cifras sin IVA.`,
    "",
    "Estado de resultados por mes:",
    ...monthly.map((m) => `- ${statementLine(m.month, m.statement)}`),
    "",
    `Total del rango: ${statementLine("total", total)}`,
    "",
    `Hoy: Cuentas por cobrar ${money(balances.receivable)} | Cuentas por pagar a proveedores ${money(balances.payable)} | Inventario valorizado al costo ${money(balances.inventory)}`,
    "",
    `Salud (reglas de Miel): ${healthSummary(health.summary)}`,
    ...health.indicators.map((i) => `- ${HEALTH_LABEL[i.id]}: ${healthValue(i)} (${i.status})`),
    "",
    "Productos con más ventas en el rango (nombre | unidades | ventas | margen bruto):",
    ...(products.length
      ? products.map((p) => `- ${p.name} | ${p.qty} | ${money(p.sales)} | ${(p.margin * 100).toFixed(1)}%`)
      : ["- (sin ventas)"]),
  ].join("\n");
}
