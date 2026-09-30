"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AllocationItem = { productId: string; name: string; qty: number };
export type AllocationWarehouse = { id: string; name: string; lendsStock: boolean };
/** Stock por producto y bodega: stock[productId][warehouseId]. */
export type StockMap = Record<string, Record<string, number>>;
export type AllocationRow = { warehouseId: string; qty: number };
/** Filas bodega + cantidad por producto; la primera es la bodega de la venta. */
export type AllocationRows = Record<string, AllocationRow[]>;
export type Allocation = { product_id: string; warehouse_id: string; qty: number };

const available = (stock: StockMap, productId: string, warehouseId: string) =>
  Math.max(stock[productId]?.[warehouseId] ?? 0, 0);

/** Filas de un producto: las elegidas o, por defecto, la bodega de la venta con lo que alcance. */
function rowsOf(item: AllocationItem, mainId: string, stock: StockMap, rows: AllocationRows): AllocationRow[] {
  return rows[item.productId] ?? [{ warehouseId: mainId, qty: Math.min(item.qty, available(stock, item.productId, mainId)) }];
}

/**
 * S18-10: ¿cada producto suma exacto lo vendido sin pedir más de lo que hay en cada bodega?
 * `allocations` es null si todo sale de la bodega de la venta (flujo de siempre).
 */
export function resolveAllocations(
  items: AllocationItem[],
  mainId: string | null,
  stock: StockMap,
  rows: AllocationRows,
): { covered: boolean; allocations: Allocation[] | null } {
  if (!mainId) return { covered: false, allocations: null };
  const all = items.map((item) => ({ item, rows: rowsOf(item, mainId, stock, rows) }));
  const covered = all.every(
    ({ item, rows: r }) =>
      r.reduce((sum, x) => sum + x.qty, 0) === item.qty &&
      r.every((x) => x.qty >= 0 && x.qty <= available(stock, item.productId, x.warehouseId)),
  );
  const simple = all.every(({ item, rows: r }) => r.length === 1 && r[0].warehouseId === mainId && r[0].qty === item.qty);
  if (simple) return { covered, allocations: null };
  const allocations = all.flatMap(({ item, rows: r }) =>
    r.filter((x) => x.qty > 0).map((x) => ({ product_id: item.productId, warehouse_id: x.warehouseId, qty: x.qty })),
  );
  return { covered, allocations };
}

/**
 * S18-10 (versión pedida por el humano): por cada producto, filas bodega + cantidad. La primera
 * es la bodega de la venta; "+ Otra bodega" agrega una con desplegable (solo las que prestan
 * stock), se ve cuánto hay y el usuario escribe cuánto saca.
 */
export function AllocationPicker({
  items,
  warehouses,
  mainId,
  stock,
  rows,
  onChange,
}: {
  items: AllocationItem[];
  warehouses: AllocationWarehouse[];
  mainId: string | null;
  stock: StockMap;
  rows: AllocationRows;
  onChange: (rows: AllocationRows) => void;
}) {
  const t = useTranslations("sales.allocation");
  if (!mainId) return null;
  const nameOf = (id: string) => warehouses.find((w) => w.id === id)?.name ?? "—";

  return (
    <ul className="flex flex-col gap-2 text-sm">
      {items.map((item) => {
        const current = rowsOf(item, mainId, stock, rows);
        const set = (next: AllocationRow[]) => onChange({ ...rows, [item.productId]: next });
        const assigned = current.reduce((sum, x) => sum + x.qty, 0);
        const lenders = warehouses.filter(
          (w) => w.id !== mainId && w.lendsStock && !current.some((x) => x.warehouseId === w.id),
        );
        return (
          <li key={item.productId} className="flex flex-col gap-2 rounded-md border border-border p-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">
                {item.name} × {item.qty}
              </span>
              <span className={assigned === item.qty ? "text-success" : "font-medium text-destructive"}>
                {assigned === item.qty
                  ? t("complete")
                  : assigned < item.qty
                    ? t("missing", { qty: item.qty - assigned })
                    : t("excess", { qty: assigned - item.qty })}
              </span>
            </div>
            {current.map((row, i) => {
              const have = available(stock, item.productId, row.warehouseId);
              const options = warehouses.filter(
                (w) => w.id === row.warehouseId || (w.id !== mainId && w.lendsStock && !current.some((x) => x.warehouseId === w.id)),
              );
              return (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto_5rem_auto] items-center gap-2">
                  {i === 0 ? (
                    <span className="truncate">{nameOf(row.warehouseId)}</span>
                  ) : (
                    <Select
                      value={row.warehouseId}
                      onValueChange={(v) => set(current.map((x, j) => (j === i ? { warehouseId: v, qty: x.qty } : x)))}
                    >
                      <SelectTrigger className="h-8 w-full min-w-0 text-xs">
                        <SelectValue placeholder={t("chooseWarehouse")} />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((w) => (
                          <SelectItem key={w.id} value={w.id} className="text-xs">
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <span className={`text-xs tabular-nums ${row.qty > have ? "text-destructive" : "text-muted-foreground"}`}>
                    {row.warehouseId ? t("have", { qty: have }) : ""}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    aria-label={t("qty")}
                    className="h-8 text-right"
                    value={row.qty}
                    onChange={(e) =>
                      set(current.map((x, j) => (j === i ? { ...x, qty: Math.max(Number(e.target.value) || 0, 0) } : x)))
                    }
                  />
                  {i === 0 ? (
                    <span />
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline underline-offset-4"
                      onClick={() => set(current.filter((_, j) => j !== i))}
                    >
                      {t("remove")}
                    </button>
                  )}
                </div>
              );
            })}
            {lenders.length > 0 ? (
              <div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    set([...current, { warehouseId: "", qty: Math.max(item.qty - assigned, 0) }])
                  }
                >
                  {t("addWarehouse")}
                </Button>
              </div>
            ) : assigned < item.qty ? (
              <span className="text-xs text-muted-foreground">{t("notEnough")}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
