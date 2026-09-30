"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export type AllocationItem = { productId: string; name: string; qty: number };
export type AllocationWarehouse = { id: string; name: string; lendsStock: boolean };
/** Stock por producto y bodega: stock[productId][warehouseId]. */
export type StockMap = Record<string, Record<string, number>>;
/** Lo que se completa desde otras bodegas, por producto. */
export type Extras = Record<string, { warehouseId: string; qty: number }[]>;
export type Allocation = { product_id: string; warehouse_id: string; qty: number };

function lineParts(item: AllocationItem, mainId: string | null, stock: StockMap, extras: Extras) {
  const mainStock = mainId ? Math.max(stock[item.productId]?.[mainId] ?? 0, 0) : 0;
  const fromMain = Math.min(item.qty, mainStock);
  // Si bajó la cantidad, lo completado de otras bodegas se recorta a lo que falta.
  let need = item.qty - fromMain;
  const extra: { warehouseId: string; qty: number }[] = [];
  for (const e of extras[item.productId] ?? []) {
    const take = Math.min(e.qty, need);
    if (take > 0) extra.push({ warehouseId: e.warehouseId, qty: take });
    need -= take;
  }
  return { mainStock, fromMain, extra, remaining: need };
}

/**
 * S18-10: ¿alcanza lo de la bodega de la venta? `allocations` es null si todo sale de ella (flujo
 * de siempre); si se completó desde otras, el reparto completo para la BD.
 */
export function resolveAllocations(
  items: AllocationItem[],
  mainId: string | null,
  stock: StockMap,
  extras: Extras,
): { covered: boolean; allocations: Allocation[] | null } {
  if (!mainId) return { covered: false, allocations: null };
  const parts = items.map((item) => ({ item, ...lineParts(item, mainId, stock, extras) }));
  const covered = parts.every((p) => p.remaining <= 0);
  if (parts.every((p) => p.extra.length === 0)) return { covered, allocations: null };
  const allocations = parts.flatMap(({ item, fromMain, extra }) => [
    ...(fromMain > 0 ? [{ product_id: item.productId, warehouse_id: mainId, qty: fromMain }] : []),
    ...extra.map((e) => ({ product_id: item.productId, warehouse_id: e.warehouseId, qty: e.qty })),
  ]);
  return { covered, allocations };
}

/**
 * S18-10: al lado de cada producto, cuánto hay en la bodega de la venta; si no alcanza, "Faltan X"
 * y un botón por cada bodega que presta stock ("Completar X de Kreadu (hay 10)"). Se pregunta
 * cada vez: Miel no decide sola de dónde sacar.
 */
export function AllocationPicker({
  items,
  warehouses,
  mainId,
  stock,
  extras,
  onChange,
}: {
  items: AllocationItem[];
  warehouses: AllocationWarehouse[];
  mainId: string | null;
  stock: StockMap;
  extras: Extras;
  onChange: (extras: Extras) => void;
}) {
  const t = useTranslations("sales.allocation");
  const mainName = warehouses.find((w) => w.id === mainId)?.name ?? "—";
  const nameOf = (id: string) => warehouses.find((w) => w.id === id)?.name ?? "—";

  if (!mainId) return null;

  return (
    <ul className="flex flex-col gap-2 text-sm">
      {items.map((item) => {
        const { mainStock, extra, remaining } = lineParts(item, mainId, stock, extras);
        const used = new Set(extra.map((e) => e.warehouseId));
        const options = warehouses
          .filter((w) => w.id !== mainId && w.lendsStock && !used.has(w.id))
          .map((w) => ({ ...w, available: Math.max(stock[item.productId]?.[w.id] ?? 0, 0) }))
          .filter((w) => w.available > 0);
        return (
          <li key={item.productId} className="flex flex-col gap-1 rounded-md border border-border p-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">
                {item.name} × {item.qty}
              </span>
              <span className={remaining > 0 ? "text-destructive" : "text-muted-foreground"}>
                {t("available", { qty: mainStock, warehouse: mainName })}
              </span>
            </div>
            {extra.map((e) => (
              <div key={e.warehouseId} className="flex items-center justify-between gap-2 text-muted-foreground">
                <span>{t("fromOther", { qty: e.qty, warehouse: nameOf(e.warehouseId) })}</span>
                <button
                  type="button"
                  className="text-xs underline underline-offset-4"
                  onClick={() =>
                    onChange({ ...extras, [item.productId]: extra.filter((x) => x.warehouseId !== e.warehouseId) })
                  }
                >
                  {t("remove")}
                </button>
              </div>
            ))}
            {remaining > 0 ? (
              <div className="flex flex-col gap-1">
                <span className="font-medium text-destructive">{t("missing", { qty: remaining })}</span>
                {options.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {options.map((w) => {
                      const qty = Math.min(remaining, w.available);
                      return (
                        <Button
                          key={w.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onChange({ ...extras, [item.productId]: [...extra, { warehouseId: w.id, qty }] })
                          }
                        >
                          {t("complete", { qty, warehouse: w.name, available: w.available })}
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("notEnough")}</span>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
