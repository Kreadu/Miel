"use client";

import { useActionState } from "react";

import { updateWarehouse } from "@/actions/warehouses";
import { Button } from "@/components/ui/button";

import { type WarehouseDetails, WarehouseFields } from "./warehouse-fields";

/**
 * S19-25: la bodega o sucursal principal se muestra siempre con todos sus datos, en un formulario
 * ya relleno. member la ve sin poder editar (RLS de update es owner/admin igual).
 */
export function PrincipalForm({
  id,
  details,
  canManage,
}: {
  id: string;
  details: WarehouseDetails;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(updateWarehouse, null);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold tracking-tight">Bodega o sucursal principal</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          Principal
        </span>
      </div>
      <input type="hidden" name="id" value={id} />
      <fieldset disabled={!canManage} className="contents">
        <WarehouseFields idPrefix="principal" values={details} />
      </fieldset>
      {canManage ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
          {state?.ok ? <span className="text-sm text-muted-foreground">Guardado.</span> : null}
        </div>
      ) : null}
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
