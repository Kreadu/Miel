"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { updateWarehouse } from "@/actions/warehouses";
import { Button } from "@/components/ui/button";

import { TransferForm, type TransferProduct } from "./transfer-form";
import { type WarehouseDetails, WarehouseFields } from "./warehouse-fields";

/**
 * S19-25/S19-38: la bodega principal con todos sus datos, primero en modo lectura; "Editar"
 * habilita los campos ("Guardar"/"Cancelar"). member la ve sin poder editar (RLS igual). La
 * principal no se puede dar de baja (regla de la BD).
 */
export function PrincipalForm({
  id,
  details,
  canManage,
  transfer,
}: {
  id: string;
  details: WarehouseDetails;
  canManage: boolean;
  transfer: {
    fromId: string;
    fromName: string;
    destinations: { id: string; name: string }[];
    products: TransferProduct[];
  };
}) {
  const [state, action, pending] = useActionState(updateWarehouse, null);
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  // "Cancelar" vuelve a montar los campos con los valores guardados.
  const [formKey, setFormKey] = useState(0);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setEditing(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        action={action}
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight">
            {t("warehouses.principalTitle")}
          </h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
            {t("warehouses.principal")}
          </span>
        </div>
        <input type="hidden" name="id" value={id} />
        <fieldset
          key={formKey}
          disabled={!canManage || !editing}
          className="contents"
        >
          <WarehouseFields idPrefix="principal" values={details} />
        </fieldset>
        {canManage ? (
          editing ? (
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? t("warehouses.saving") : t("warehouses.save")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setEditing(false);
                  setFormKey((k) => k + 1);
                }}
              >
                {t("warehouses.cancel")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                {t("warehouses.edit")}
              </Button>
              {state?.ok ? (
                <span className="text-sm text-muted-foreground">
                  {t("warehouses.saved")}
                </span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {t("warehouses.principalCannotRetire")}
              </span>
            </div>
          )
        ) : null}
        {state && !state.ok ? (
          <p role="alert" className="text-sm text-destructive">
            {t(state.error)}
          </p>
        ) : null}
      </form>
      {canManage &&
      transfer.products.length > 0 &&
      transfer.destinations.length > 0 ? (
        <TransferForm {...transfer} />
      ) : null}
    </div>
  );
}
