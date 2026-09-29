export type WarehouseStock = { warehouseName: string; qty: number };

/**
 * S19-17/S19-24: stock por producto, desglosado por bodega o sucursal, a partir de filas de
 * `current_stock`. El total es la suma del desglose.
 */
export function stockByProduct(
  rows: { product_id: string | null; warehouse_id: string | null; total_qty: number | null }[],
  warehouseNameById: Map<string, string>,
): Map<string, WarehouseStock[]> {
  const result = new Map<string, WarehouseStock[]>();
  for (const row of rows) {
    if (!row.product_id || !row.warehouse_id) continue;
    const list = result.get(row.product_id) ?? [];
    list.push({
      warehouseName: warehouseNameById.get(row.warehouse_id) ?? "—",
      qty: row.total_qty ?? 0,
    });
    result.set(row.product_id, list);
  }
  return result;
}
