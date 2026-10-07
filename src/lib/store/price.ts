import { round2 } from "@/lib/money";
import { saleLine } from "@/lib/sales/line";

/**
 * S27-01: precio al consumidor (descuento + IVA, misma cuenta que una venta de 1 unidad) y el
 * precio anterior con IVA para tacharlo si hay descuento.
 */
export function storePrice(price: number, discountPercent: number, taxRate: number) {
  const { net, tax } = saleLine(1, price, discountPercent, taxRate);
  return {
    final: round2(net + tax),
    before: discountPercent > 0 ? round2(price * (1 + taxRate / 100)) : null,
  };
}
