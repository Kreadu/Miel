const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * S19-37: línea de una orden de compra. `unitWithTax` (costo del proveedor + IVA) es el costo
 * que toma el producto al recibir la orden (receive_purchase usa la misma cuenta).
 */
export function purchaseLine(
  qty: number,
  unitCost: number,
  taxRate: number,
): { unitWithTax: number; total: number } {
  const unitWithTax = round2(unitCost * (1 + taxRate / 100));
  return { unitWithTax, total: round2(qty * unitWithTax) };
}

/** S19-37: costo antes de IVA a partir del costo del producto (que ya incluye IVA). */
export function costBeforeTax(costWithTax: number, taxRate: number): number {
  return round2(costWithTax / (1 + taxRate / 100));
}
