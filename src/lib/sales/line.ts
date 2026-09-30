import { round2 } from "@/lib/money";

/**
 * S23-01: línea de venta, misma cuenta que create_sale en la BD: descuento =
 * round(qty·precio·%/100), línea = round(qty·precio − descuento), IVA = round(línea·tasa/100).
 */
export function saleLine(qty: number, price: number, discountPercent: number, taxRate: number) {
  const discount = round2((qty * price * discountPercent) / 100);
  const net = round2(qty * price - discount);
  return { net, tax: round2((net * taxRate) / 100) };
}
