"use server";

import { isSupportedCurrency } from "@/lib/currency";

export type ExchangeRateState = { ok: true; rate: number } | { ok: false; error: string };

/**
 * S19-04: conversión de VISTA, no de cobro. Pide la tasa del lado del servidor (no del
 * navegador) para no tener que agregar el dominio de la API a connect-src del CSP — el
 * navegador nunca ve esta URL, solo el resultado numérico.
 */
export async function getExchangeRate(base: string, target: string): Promise<ExchangeRateState> {
  if (!isSupportedCurrency(base) || !isSupportedCurrency(target)) {
    return { ok: false, error: "catalog.errors.currencyUnsupported" };
  }
  if (base === target) return { ok: true, rate: 1 };

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { ok: false, error: "catalog.errors.rateFailed" };

    const data: { rates?: Record<string, number> } = await res.json();
    const rate = data.rates?.[target];
    if (typeof rate !== "number") return { ok: false, error: "catalog.errors.currencyUnavailable" };

    return { ok: true, rate };
  } catch (error) {
    console.error("getExchangeRate:", error);
    return { ok: false, error: "catalog.errors.rateOffline" };
  }
}
