"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { confirmSale } from "@/actions/sales";
import { Button } from "@/components/ui/button";

import {
  AllocationPicker,
  type AllocationItem,
  type AllocationWarehouse,
  type AllocationState,
  EMPTY_ALLOCATION,
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
  canManage,
}: {
  saleId: string;
  items: AllocationItem[];
  warehouses: AllocationWarehouse[];
  stock: StockMap;
  defaultWarehouseId: string | null;
  canManage: boolean;
}) {
  const t = useTranslations();
  const [confirming, setConfirming] = useState(false);
  const warehouseId = defaultWarehouseId ?? "";
  const [alloc, setAlloc] = useState<AllocationState>(EMPTY_ALLOCATION);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { covered, allocations } = resolveAllocations(items, alloc);

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" className="h-7 w-full text-xs" onClick={() => setConfirming(true)}>
        {t("sales.orders.confirm")}
      </Button>
    );
  }

  return (
    <div className="flex min-w-[240px] flex-col gap-2">
      <p className="text-xs font-medium">{t("sales.allocation.title")}</p>
      <AllocationPicker
        items={items}
        warehouses={warehouses}
        homeId={warehouseId || null}
        stock={stock}
        value={alloc}
        onChange={setAlloc}
        canManage={canManage}
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
              const res = await confirmSale(saleId, warehouseId, allocations);
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
