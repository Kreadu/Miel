"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { setWarehouseLends } from "@/actions/warehouses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AllocationItem = { productId: string; name: string; qty: number };
export type AllocationWarehouse = { id: string; name: string; lendsStock: boolean };
/** Stock por producto y bodega: stock[productId][warehouseId]. */
export type StockMap = Record<string, Record<string, number>>;
export type AllocationRow = { warehouseId: string; qty: number };
/** Lo asignado por producto y qué productos ya se aceptaron. */
export type AllocationState = { assignments: Record<string, AllocationRow[]>; accepted: Record<string, boolean> };
export type Allocation = { product_id: string; warehouse_id: string; qty: number };

export const EMPTY_ALLOCATION: AllocationState = { assignments: {}, accepted: {} };

const availableIn = (stock: StockMap, productId: string, warehouseId: string) =>
  Math.max(stock[productId]?.[warehouseId] ?? 0, 0);

/** La bodega propia (la del trabajador o la principal) siempre; otra, solo si presta stock. */
export function canUseWarehouse(w: AllocationWarehouse, homeId: string | null): boolean {
  return w.id === homeId || w.lendsStock;
}

/** Listo = cada producto aceptado y con lo asignado sumando exacto lo vendido. */
export function resolveAllocations(
  items: AllocationItem[],
  state: AllocationState,
): { covered: boolean; allocations: Allocation[] } {
  const covered = items.every(
    (item) =>
      state.accepted[item.productId] &&
      (state.assignments[item.productId] ?? []).reduce((sum, r) => sum + r.qty, 0) === item.qty,
  );
  const allocations = items.flatMap((item) =>
    (state.assignments[item.productId] ?? []).map((r) => ({
      product_id: item.productId,
      warehouse_id: r.warehouseId,
      qty: r.qty,
    })),
  );
  return { covered, allocations };
}

/**
 * S18-10 (flujo pedido por el humano): por cada producto se elige la bodega (todas, con su
 * stock), la cantidad y "Asignar"; se repite hasta el total y "Aceptar" lo cierra. Nada se asigna
 * solo. Las bodegas que no prestan stock se ven en gris; el dueño/admin las habilita con un clic.
 */
export function AllocationPicker({
  items,
  warehouses,
  homeId,
  stock,
  value,
  onChange,
  canManage,
}: {
  items: AllocationItem[];
  warehouses: AllocationWarehouse[];
  homeId: string | null;
  stock: StockMap;
  value: AllocationState;
  onChange: (state: AllocationState) => void;
  canManage: boolean;
}) {
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {items.map((item) => (
        <ProductAllocation
          key={item.productId}
          item={item}
          warehouses={warehouses}
          homeId={homeId}
          stock={stock}
          rows={value.assignments[item.productId] ?? []}
          accepted={Boolean(value.accepted[item.productId])}
          canManage={canManage}
          onRows={(rows) =>
            onChange({
              assignments: { ...value.assignments, [item.productId]: rows },
              accepted: { ...value.accepted, [item.productId]: false },
            })
          }
          onAccepted={(accepted) => onChange({ ...value, accepted: { ...value.accepted, [item.productId]: accepted } })}
        />
      ))}
    </ul>
  );
}

function ProductAllocation({
  item,
  warehouses,
  homeId,
  stock,
  rows,
  accepted,
  canManage,
  onRows,
  onAccepted,
}: {
  item: AllocationItem;
  warehouses: AllocationWarehouse[];
  homeId: string | null;
  stock: StockMap;
  rows: AllocationRow[];
  accepted: boolean;
  canManage: boolean;
  onRows: (rows: AllocationRow[]) => void;
  onAccepted: (accepted: boolean) => void;
}) {
  const t = useTranslations("sales.allocation");
  const tr = useTranslations();
  const [warehouseId, setWarehouseId] = useState("");
  const [qty, setQty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const nameOf = (id: string) => warehouses.find((w) => w.id === id)?.name ?? "—";
  const assigned = rows.reduce((sum, r) => sum + r.qty, 0);
  const remaining = item.qty - assigned;
  const selected = warehouses.find((w) => w.id === warehouseId);
  const selectedStock = warehouseId ? availableIn(stock, item.productId, warehouseId) : 0;
  const max = Math.min(selectedStock, remaining);
  const qtyNum = Number(qty) || 0;
  const usable = selected ? canUseWarehouse(selected, homeId) : false;
  const canAssign = usable && qtyNum > 0 && qtyNum <= max;

  if (accepted && remaining === 0) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-success/40 bg-success/5 p-2">
        <span>
          <Check className="mr-1 inline size-4 text-success" aria-hidden />
          <span className="font-medium">
            {item.name} × {item.qty}
          </span>{" "}
          <span className="text-muted-foreground">
            — {rows.map((r) => t("fromWarehouse", { qty: r.qty, warehouse: nameOf(r.warehouseId) })).join(" + ")}
          </span>
        </span>
        <button type="button" className="text-xs underline underline-offset-4" onClick={() => onAccepted(false)}>
          {t("change")}
        </button>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">
          {item.name} × {item.qty}
        </span>
        <span className={remaining === 0 ? "text-success" : "font-medium text-destructive"}>
          {remaining === 0 ? t("complete") : t("missing", { qty: remaining })}
        </span>
      </div>

      {rows.map((r) => (
        <div key={r.warehouseId} className="flex items-center justify-between gap-2">
          <span>
            <Check className="mr-1 inline size-4 text-success" aria-hidden />
            {t("fromWarehouse", { qty: r.qty, warehouse: nameOf(r.warehouseId) })}
          </span>
          <button
            type="button"
            aria-label={t("remove")}
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onRows(rows.filter((x) => x.warehouseId !== r.warehouseId))}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}

      {remaining > 0 ? (
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-2">
            <Select
              value={warehouseId}
              onValueChange={(v) => {
                setWarehouseId(v);
                setQty(String(Math.min(remaining, availableIn(stock, item.productId, v))));
                setError(null);
              }}
            >
              <SelectTrigger className="h-8 w-full min-w-0 text-xs">
                <SelectValue placeholder={t("chooseWarehouse")} />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => {
                  const have = availableIn(stock, item.productId, w.id);
                  const used = rows.some((r) => r.warehouseId === w.id);
                  return (
                    <SelectItem
                      key={w.id}
                      value={w.id}
                      disabled={used || have === 0}
                      className={`text-xs ${canUseWarehouse(w, homeId) ? "" : "text-muted-foreground"}`}
                    >
                      {t("option", { warehouse: w.name, qty: have })}
                      {canUseWarehouse(w, homeId) ? "" : ` ${t("notLending")}`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              step="1"
              aria-label={t("qty")}
              className="h-8 text-right"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              disabled={!canAssign}
              onClick={() => {
                onRows([...rows, { warehouseId, qty: qtyNum }]);
                setWarehouseId("");
                setQty("");
              }}
            >
              {t("assign")}
            </Button>
          </div>
          {selected && !usable ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{t("notLendingHelp", { warehouse: selected.name })}</span>
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await setWarehouseLends(selected.id, true);
                      setError(res.ok ? null : res.error);
                    })
                  }
                >
                  {t("allowLending")}
                </Button>
              ) : (
                <span>{t("askManager")}</span>
              )}
            </div>
          ) : null}
          {selected && usable && qtyNum > max ? (
            <span className="text-xs text-destructive">{t("tooMany", { max })}</span>
          ) : null}
          {error ? <span className="text-xs text-destructive">{tr(error)}</span> : null}
        </div>
      ) : (
        <div>
          <Button type="button" size="sm" onClick={() => onAccepted(true)}>
            {t("accept")}
          </Button>
        </div>
      )}
    </li>
  );
}
