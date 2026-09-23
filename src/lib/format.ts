// Formateo centralizado de fechas y montos — hora de Colombia (S12-02).
// Bogotá no tiene horario de verano: offset fijo UTC-5 todo el año.
const LOCALE = "es-CO";
const TIME_ZONE = "America/Bogota";
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

export function formatDate(value: string | Date, options: Intl.DateTimeFormatOptions = {}): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "numeric",
    year: "numeric",
    ...options,
  }).format(date);
}

export function formatDateTime(value: string | Date, options: Intl.DateTimeFormatOptions = {}): string {
  return formatDate(value, { hour: "2-digit", minute: "2-digit", ...options });
}

export function formatMoney(
  value: number | string | null | undefined,
  options: Intl.NumberFormatOptions = {},
): string {
  const amount = value == null ? 0 : Number(value);
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
}

/** ISO UTC -> valor de un <input type="datetime-local"> interpretado en hora Bogotá. */
export function toDatetimeLocalValue(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(new Date(value).getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 16);
}

/** Valor de un <input type="datetime-local"> (hora Bogotá) -> ISO UTC. */
export function fromDatetimeLocalValue(value: string): string {
  return new Date(`${value}:00-05:00`).toISOString();
}
