import { round2 } from "./money";

/** S19-34: precio de venta = costo + % de venta sobre el costo. */
export function priceFromMarkup(cost: number, markupPercent: number): number {
  return round2(cost * (1 + markupPercent / 100));
}

/** S19-34: % de venta sobre el costo que da un precio (null si no hay costo). */
export function markupFromPrice(cost: number, price: number): number | null {
  if (!(cost > 0)) return null;
  return round2((price / cost - 1) * 100);
}

/**
 * S28-02: lo que pasa al recibir `qty` a `unitCost`: costo promedio nuevo (como register_movement)
 * y precio con el mismo % sobre el costo, redondeado al peso (como receive_purchase_line). Sin
 * costo anterior o sin precio, el precio no se toca.
 */
export function receiptPricePreview(p: {
  stock: number;
  cost: number;
  price: number;
  qty: number;
  unitCost: number;
}): { cost: number; price: number } {
  const stock = Math.max(p.stock, 0);
  const cost = stock > 0 ? round2((stock * p.cost + p.qty * p.unitCost) / (stock + p.qty)) : round2(p.unitCost);
  const price = p.cost > 0 && p.price > 0 && cost !== p.cost ? Math.round((p.price * cost) / p.cost) : p.price;
  return { cost, price };
}
