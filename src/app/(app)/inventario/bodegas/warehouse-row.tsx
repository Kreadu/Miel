"use client";

import { useActionState, useState } from "react";

import { toggleWarehouseActive, updateWarehouse } from "@/actions/warehouses";
import { Button } from "@/components/ui/button";

import { type WarehouseDetails, WarehouseFields, warehouseSummary } from "./warehouse-fields";

export function WarehouseRow({
  id,
  active,
  isDefault,
  canManage,
  details,
}: {
  id: string;
  active: boolean;
  /** S19-18: la principal se renombra y edita, pero no se archiva. */
  isDefault: boolean;
  canManage: boolean;
  details: WarehouseDetails;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateWarehouse, null);
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
              {pending ? "Guardando…" : "Guardar"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
          {state && !state.ok ? (
            <p role="alert" className="text-xs text-destructive">
              {state.error}
            </p>
          ) : null}
        </form>
      </li>
    );
  }

  const summary = warehouseSummary(details);

  return (
    <li className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className={active ? "font-medium" : "text-muted-foreground line-through"}>
            {details.name}
          </span>
          {isDefault ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              Principal
            </span>
          ) : null}
        </div>
        {summary ? <span className="text-xs text-muted-foreground">{summary}</span> : null}
      </div>
      {canManage ? (
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
          {isDefault ? null : (
            <form action={toggleWarehouseActive}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="active" value={(!active).toString()} />
              <Button type="submit" variant="ghost" size="sm">
                {active ? "Archivar" : "Reactivar"}
              </Button>
            </form>
          )}
        </div>
      ) : (
        !active && <span className="text-xs text-muted-foreground">Archivada</span>
      )}
    </li>
  );
}
