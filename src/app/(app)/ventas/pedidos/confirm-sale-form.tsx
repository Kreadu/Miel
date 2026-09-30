"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { confirmSale } from "@/actions/sales";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  AllocationPicker,
  type AllocationItem,
  type AllocationWarehouse,
  type AllocationRows,
  resolveAllocations,
  type StockMap,
} from "./allocation-picker";

/**
 * Confirmar un pedido (boleta + stock). S18-10: se ve cuánto hay en la bodega elegida y, si no
 * alcanza, se completa desde otra que preste stock (se pregunta cada vez).
 */
export function ConfirmSaleForm({
  saleId,
  items,
  warehouses,
  stock,
  defaultWarehouseId,
}: {
  saleId: string;
  items: AllocationItem[];
  warehouses: AllocationWarehouse[];
  stock: StockMap;
  defaultWarehouseId: string | null;
}) {
  const t = useTranslations();
  const [confirming, setConfirming] = useState(false);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId ?? "");
  const [rows, setRows] = useState<AllocationRows>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { covered, allocations } = resolveAllocations(items, warehouseId || null, stock, rows);

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" className="h-7 w-full text-xs" onClick={() => setConfirming(true)}>
        {t("sales.orders.confirm")}
      </Button>
    );
  }

  return (
    <div className="flex min-w-[240px] flex-col gap-2">
      <Select
        value={warehouseId}
        onValueChange={(v) => {
          setWarehouseId(v);
          setRows({});
        }}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={t("sales.orders.warehousePlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {warehouses.map((w) => (
            <SelectItem key={w.id} value={w.id} className="text-xs">
              {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <AllocationPicker
        items={items}
        warehouses={warehouses}
        mainId={warehouseId || null}
        stock={stock}
        rows={rows}
        onChange={setRows}
      />
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          className="h-7 flex-1 text-xs"
          disabled={pending || !warehouseId || !covered}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await confirmSale(saleId, warehouseId, allocations ?? undefined);
              if (res?.ok) setConfirming(false);
              else setError(res?.error ?? "common.errors.unknown");
            });
          }}
        >
          {pending ? "..." : t("sales.orders.confirm")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 flex-1 text-xs"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          {t("sales.orders.cancel")}
        </Button>
      </div>
      {error ? <p className="text-xs leading-tight text-destructive">{t(error)}</p> : null}
    </div>
  );
}
