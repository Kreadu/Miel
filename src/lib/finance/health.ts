import type { IncomeStatement } from "./income-statement";

/**
 * S22-03: salud de la empresa con reglas fijas (sin IA), sobre el rango elegido. Umbrales en
 * specs/S22-03-analisis-salud-y-asesor-ia.md. Cada indicador lleva estado + frase legible.
 */
export type HealthStatus = "good" | "warning" | "critical";
export type HealthIndicator = { id: string; label: string; status: HealthStatus; value: string; detail: string };

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function grade(value: number, good: number, warning: number): HealthStatus {
  if (value >= good) return "good";
  return value >= warning ? "warning" : "critical";
}

export function assessHealth({
  monthly,
  total,
  receivable,
  payable,
  inventory,
}: {
  monthly: IncomeStatement[];
  total: IncomeStatement;
  receivable: number;
  payable: number;
  inventory: number;
}): { indicators: HealthIndicator[]; summary: string } {
  if (total.income <= 0) {
    return { indicators: [], summary: "Sin datos suficientes: no hay ventas en el rango elegido." };
  }
  const net = total.netProfit / total.income;
  const gross = total.grossProfit / total.income;
  const operating = total.ebit / total.income;
  const indicators: HealthIndicator[] = [
    {
      id: "net",
      label: "Rentabilidad",
      status: grade(net, 0.1, 0),
      value: pct(net),
      detail: net < 0 ? "La empresa pierde dinero en el rango." : `De cada $100 vendidos quedan $${(net * 100).toFixed(0)} de ganancia.`,
    },
    {
      id: "gross",
      label: "Margen bruto",
      status: grade(gross, 0.3, 0.15),
      value: pct(gross),
      detail: "Lo que queda de las ventas después del costo de lo vendido.",
    },
    {
      id: "operating",
      label: "Margen operativo",
      status: grade(operating, 0.08, 0),
      value: pct(operating),
      detail: "Lo que queda después de pagar la operación (gastos y nómina).",
    },
  ];

  if (monthly.length >= 2) {
    const last = monthly[monthly.length - 1].income;
    const before = monthly.slice(0, -1);
    const avg = before.reduce((s, m) => s + m.income, 0) / before.length;
    if (avg > 0) {
      const change = last / avg - 1;
      indicators.push({
        id: "trend",
        label: "Tendencia de ventas",
        status: grade(change, 0, -0.15),
        value: `${change >= 0 ? "+" : ""}${pct(change)}`,
        detail: "Ventas del último mes frente al promedio de los meses anteriores del rango.",
      });
    }
  }

  const liquidity = payable > 0 ? (receivable + inventory) / payable : null;
  indicators.push({
    id: "liquidity",
    label: "Liquidez",
    status: liquidity === null ? "good" : grade(liquidity, 1.5, 1),
    value: liquidity === null ? "Sin deudas" : `${liquidity.toFixed(2)} veces`,
    detail: "Cartera más inventario frente a lo que se debe a proveedores.",
  });

  const critical = indicators.filter((i) => i.status === "critical").length;
  const warning = indicators.filter((i) => i.status === "warning").length;
  const summary =
    critical > 0
      ? `Atención urgente: ${critical} indicador${critical > 1 ? "es" : ""} en rojo.`
      : warning > 0
        ? `Empresa estable, con ${warning} punto${warning > 1 ? "s" : ""} por mejorar.`
        : "Empresa sana en el rango elegido.";
  return { indicators, summary };
}
