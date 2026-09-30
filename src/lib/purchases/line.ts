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
