export const SUPPORTED_CURRENCIES = [
  { code: "COP", label: "Peso colombiano" },
  { code: "USD", label: "Dólar estadounidense" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "Libra esterlina" },
  { code: "MXN", label: "Peso mexicano" },
  { code: "ARS", label: "Peso argentino" },
  { code: "BRL", label: "Real brasileño" },
  { code: "CLP", label: "Peso chileno" },
  { code: "PEN", label: "Sol peruano" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return SUPPORTED_CURRENCIES.some((c) => c.code === code);
}

// Monedas que tradicionalmente se muestran sin decimales.
const ZERO_DECIMAL_CURRENCIES = new Set(["COP", "CLP"]);

export function formatMoney(amount: number, currency: string): string {
  const maximumFractionDigits = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
  try {
    return amount.toLocaleString("es-CO", {
      style: "currency",
      currency,
      maximumFractionDigits,
    });
  } catch {
    return `${amount.toFixed(maximumFractionDigits)} ${currency}`;
  }
}
