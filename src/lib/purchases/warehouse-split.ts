/**
 * S26-11: una línea del formulario de orden = un producto con su costo y la cantidad para cada
 * bodega. En la BD es un `purchase_items` por bodega con cantidad > 0.
 */
export type SplitLine = {
  product_id: string;
  unit_cost: string;
  tax_rate: string;
  /** Cantidad única (cuando la empresa tiene una sola bodega). */
  qty: string;
  /** Cantidad por bodega (cuando tiene varias). */
  byWarehouse: Record<string, string>;
};

export type SplitWarehouse = { id: string; is_default: boolean };

export type PurchaseItemInput = {
  product_id: string;
  warehouse_id: string | null;
  qty: string;
  unit_cost: string;
  tax_rate: string;
};

const multi = (warehouses: SplitWarehouse[]) => warehouses.length > 1;

/** Total pedido del producto (suma de bodegas). */
export function splitTotal(line: SplitLine, warehouses: SplitWarehouse[]): number {
  if (!multi(warehouses)) return Number(line.qty) || 0;
  return warehouses.reduce((sum, w) => sum + (Number(line.byWarehouse[w.id]) || 0), 0);
}

/** Líneas del formulario → ítems para create/update_purchase. */
export function toPurchaseItems(lines: SplitLine[], warehouses: SplitWarehouse[]): PurchaseItemInput[] {
  return lines
    .filter((l) => l.product_id)
    .flatMap((l) => {
      const base = { product_id: l.product_id, unit_cost: l.unit_cost, tax_rate: l.tax_rate };
      if (!multi(warehouses)) return [{ ...base, warehouse_id: warehouses[0]?.id ?? null, qty: l.qty }];
      return warehouses
        .filter((w) => (Number(l.byWarehouse[w.id]) || 0) > 0)
        .map((w) => ({ ...base, warehouse_id: w.id, qty: l.byWarehouse[w.id] }));
    });
}

/** Ítems guardados → líneas del formulario (los viejos sin bodega cuentan en la principal). */
export function groupByProduct(
  items: { product_id: string; warehouse_id: string | null; qty: number; unit_cost: number; tax_rate: number }[],
  warehouses: SplitWarehouse[],
): SplitLine[] {
  const fallback = (warehouses.find((w) => w.is_default) ?? warehouses[0])?.id;
  const lines = new Map<string, SplitLine>();
  for (const it of items) {
    const key = `${it.product_id}|${it.unit_cost}|${it.tax_rate}`;
    const line =
      lines.get(key) ??
      { product_id: it.product_id, unit_cost: String(it.unit_cost), tax_rate: String(it.tax_rate), qty: "0", byWarehouse: {} };
    const wh = it.warehouse_id ?? fallback;
    if (wh) line.byWarehouse[wh] = String((Number(line.byWarehouse[wh]) || 0) + Number(it.qty));
    line.qty = String(Number(line.qty) + Number(it.qty));
    lines.set(key, line);
  }
  return [...lines.values()];
}
