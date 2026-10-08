import { round2 } from "@/lib/money";

/**
 * S19-37/S23-01: línea de una orden de compra. `unitWithTax` (costo del proveedor + IVA) es lo
 * que se le paga por unidad; el costo del producto es `unitCost` (sin IVA: se recupera).
 * `total` = qty · costo · (1 + IVA), redondeado igual que create_purchase.
 */
export function purchaseLine(
  qty: number,
  unitCost: number,
  taxRate: number,
): { unitWithTax: number; total: number } {
  return {
    unitWithTax: round2(unitCost * (1 + taxRate / 100)),
    total: round2(qty * unitCost * (1 + taxRate / 100)),
  };
}

/**
 * S28-01: lo que falta recibir de la orden, para comparar con la factura del proveedor
 * (subtotal sin IVA, IVA y total; IVA redondeado por línea como create_purchase).
 */
export function pendingTotals(
  items: { qty: number; received_qty: number; unit_cost: number; tax_rate: number }[],
): { subtotal: number; tax: number; total: number } {
  let subtotal = 0;
  let tax = 0;
  for (const it of items) {
    const pending = Math.max(Number(it.qty) - Number(it.received_qty), 0);
    const base = round2(pending * Number(it.unit_cost));
    subtotal += base;
    tax += round2((base * Number(it.tax_rate)) / 100);
  }
  return { subtotal: round2(subtotal), tax: round2(tax), total: round2(subtotal + tax) };
}
