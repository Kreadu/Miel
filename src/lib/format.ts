import { round2 } from "./money";

// Formateo centralizado de fechas y montos — hora de Colombia (S12-02).
// Bogotá no tiene horario de verano: offset fijo UTC-5 todo el año.
const LOCALE = "es-CO";
const TIME_ZONE = "America/Bogota";
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

// Una fecha sin hora ("AAAA-MM-DD", p. ej. columnas `date`) es un día calendario: se lee al
// mediodía de Bogotá. `new Date("AAAA-MM-DD")` sería medianoche UTC = el día anterior en Bogotá.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatDate(value: string | Date, options: Intl.DateTimeFormatOptions = {}): string {
  const date =
    typeof value === "string"
      ? new Date(DATE_ONLY.test(value) ? `${value}T12:00:00-05:00` : value)
      : value;
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

/** S23-01: 2 decimales si el monto tiene centavos, 0 si es entero. */
export function centsDigits(amount: number): 0 | 2 {
  return Number.isInteger(round2(amount)) ? 0 : 2;
}

export function formatMoney(
  value: number | string | null | undefined,
  options: Intl.NumberFormatOptions = {},
): string {
  const amount = value == null ? 0 : Number(value);
  // S23-01: un solo formato de dinero en todo Miel — centavos solo si los hay (1.500 / 1.234,50).
  const digits = centsDigits(amount);
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
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
