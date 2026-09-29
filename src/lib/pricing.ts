const round2 = (n: number) => Math.round(n * 100) / 100;

/** S19-34: precio de venta = costo + % de venta sobre el costo. */
export function priceFromMarkup(cost: number, markupPercent: number): number {
  return round2(cost * (1 + markupPercent / 100));
}

/** S19-34: % de venta sobre el costo que da un precio (null si no hay costo). */
export function markupFromPrice(cost: number, price: number): number | null {
  if (!(cost > 0)) return null;
  return round2((price / cost - 1) * 100);
}
