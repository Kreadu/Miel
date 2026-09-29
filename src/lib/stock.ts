/** S19-17: stock total por producto (todas las bodegas) a partir de filas de `current_stock`. */
export function totalStockByProduct(
  rows: { product_id: string | null; total_qty: number | null }[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.product_id) continue;
    totals.set(row.product_id, (totals.get(row.product_id) ?? 0) + (row.total_qty ?? 0));
  }
  return totals;
}
