/** S22-03: rango de meses ("AAAA-MM") del estado de resultados, los gráficos y el asesor con IA. */
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DEFAULT_MONTHS = 6;
export const MAX_MONTHS = 24;

function shift(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const i = y * 12 + (m - 1) + delta;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

export function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  for (let m = from; m <= to; m = shift(m, 1)) months.push(m);
  return months;
}

/** Rango pedido en la URL; inválido o invertido → últimos 6 meses; más de 24 → los 24 finales. */
export function parseMonthRange(
  { desde, hasta }: { desde?: string; hasta?: string },
  currentMonth: string,
): { from: string; to: string } {
  if (!desde || !hasta || !MONTH.test(desde) || !MONTH.test(hasta) || desde > hasta) {
    return { from: shift(currentMonth, -(DEFAULT_MONTHS - 1)), to: currentMonth };
  }
  const earliest = shift(hasta, -(MAX_MONTHS - 1));
  return { from: desde < earliest ? earliest : desde, to: hasta };
}
