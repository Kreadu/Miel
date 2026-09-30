import type { IncomeStatement } from "./income-statement";

/**
 * S22-03: salud de la empresa con reglas fijas (sin IA), sobre el rango elegido. Umbrales en
 * specs/S22-03-analisis-salud-y-asesor-ia.md. S20-06: devuelve datos (estado y valor); el texto
 * lo arma la pantalla en el idioma del usuario (mensajes `results.health.*`).
 */
export type HealthStatus = "good" | "warning" | "critical";
export type HealthId = "net" | "gross" | "operating" | "trend" | "liquidity";
/** `value`: proporción (0.12 = 12 %); en liquidez, veces; `null` = sin deudas. */
export type HealthIndicator = { id: HealthId; status: HealthStatus; value: number | null };
export type HealthSummary = { kind: "noData" | "critical" | "warning" | "healthy"; count: number };

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
}): { indicators: HealthIndicator[]; summary: HealthSummary } {
  if (total.income <= 0) return { indicators: [], summary: { kind: "noData", count: 0 } };
  const net = total.netProfit / total.income;
  const gross = total.grossProfit / total.income;
  const operating = total.ebit / total.income;
  const indicators: HealthIndicator[] = [
    { id: "net", status: grade(net, 0.1, 0), value: net },
    { id: "gross", status: grade(gross, 0.3, 0.15), value: gross },
    { id: "operating", status: grade(operating, 0.08, 0), value: operating },
  ];

  if (monthly.length >= 2) {
    const last = monthly[monthly.length - 1].income;
    const before = monthly.slice(0, -1);
    const avg = before.reduce((s, m) => s + m.income, 0) / before.length;
    if (avg > 0) {
      const change = last / avg - 1;
      indicators.push({ id: "trend", status: grade(change, 0, -0.15), value: change });
    }
  }

  const liquidity = payable > 0 ? (receivable + inventory) / payable : null;
  indicators.push({
    id: "liquidity",
    status: liquidity === null ? "good" : grade(liquidity, 1.5, 1),
    value: liquidity,
  });

  const critical = indicators.filter((i) => i.status === "critical").length;
  const warning = indicators.filter((i) => i.status === "warning").length;
  const summary: HealthSummary =
    critical > 0
      ? { kind: "critical", count: critical }
      : warning > 0
        ? { kind: "warning", count: warning }
        : { kind: "healthy", count: 0 };
  return { indicators, summary };
}
