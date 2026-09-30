import { centsDigits } from "./format";

export const SUPPORTED_CURRENCIES = [
  { code: "COP" },
  { code: "USD" },
  { code: "EUR" },
  { code: "GBP" },
  { code: "MXN" },
  { code: "ARS" },
  { code: "BRL" },
  { code: "CLP" },
  { code: "PEN" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return SUPPORTED_CURRENCIES.some((c) => c.code === code);
}

// El peso chileno no tiene centavos.
const ZERO_DECIMAL_CURRENCIES = new Set(["CLP"]);

/** S23-01: mismo criterio que `lib/format` — centavos solo si los hay. */
export function formatMoney(amount: number, currency: string): string {
  const digits = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : centsDigits(amount);
  try {
    return amount.toLocaleString("es-CO", {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  } catch {
    return `${amount.toFixed(digits)} ${currency}`;
  }
}
