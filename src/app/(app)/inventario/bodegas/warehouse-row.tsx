"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { toggleWarehouseActive, updateWarehouse } from "@/actions/warehouses";
import { Button } from "@/components/ui/button";

import { TransferForm, type TransferProduct } from "./transfer-form";
import {
  type WarehouseDetails,
  WarehouseFields,
  warehouseSummary,
} from "./warehouse-fields";

export function WarehouseRow({
  id,
  active,
  canManage,
  details,
  stockUnits,
  transfer,
}: {
  id: string;
  active: boolean;
  canManage: boolean;
  details: WarehouseDetails;
  /** S19-38: unidades en stock (con stock no se da de baja: primero se traslada, S19-39). */
  stockUnits: number;
  transfer: {
    fromId: string;
    fromName: string;
    destinations: { id: string; name: string }[];
    products: TransferProduct[];
  };
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateWarehouse, null);
  const t = useTranslations();
  // Ajuste de estado durante el render (patrón oficial de React, no un efecto): al ver un
  // `state` de éxito nuevo, cierra el modo edición.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setEditing(false);
  }

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          <WarehouseFields idPrefix={id} values={details} />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? t("warehouses.saving") : t("warehouses.save")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
            >
              {t("warehouses.cancel")}
            </Button>
          </div>
          {state && !state.ok ? (
            <p role="alert" className="text-xs text-destructive">
              {t(state.error)}
            </p>
          ) : null}
        </form>
      </li>
    );
  }

  const summary = warehouseSummary(details, (phone) =>
    t("warehouses.tel", { phone }),
  );

  return (
    <li className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className={
            active ? "font-medium" : "text-muted-foreground line-through"
          }
        >
          {details.name}
        </span>
        {summary ? (
          <span className="text-xs text-muted-foreground">{summary}</span>
        ) : null}
        {details.lends_stock ? (
          <span className="text-xs text-muted-foreground">
            {t("warehouses.lendsStockTag")}
          </span>
        ) : null}
      </div>
      {canManage ? (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
          >
            {t("warehouses.edit")}
          </Button>
          {active && stockUnits > 0 ? (
            <span className="text-xs text-muted-foreground">
              {t("warehouses.transferFirst", { units: stockUnits })}
            </span>
          ) : null}
          {/* S19-25/S19-38: "Dar de baja" es borrado lógico (active=false): el kardex referencia la bodega. */}
          {active && stockUnits > 0 ? null : (
            <form
              action={toggleWarehouseActive}
              onSubmit={(e) => {
                if (active && !confirm(t("warehouses.retireConfirm", { name: details.name })))
                  e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="active" value={(!active).toString()} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className={active ? "text-destructive" : ""}
              >
                {active ? t("warehouses.retire") : t("warehouses.reactivate")}
              </Button>
            </form>
          )}
        </div>
      ) : (
        !active && (
          <span className="text-xs text-muted-foreground">
            {t("warehouses.retired")}
          </span>
        )
      )}
      {canManage &&
      transfer.products.length > 0 &&
      transfer.destinations.length > 0 ? (
        <div className="w-full sm:basis-full">
          <TransferForm {...transfer} />
        </div>
      ) : null}
    </li>
  );
}
