"use client";

import { useActionState, useState } from "react";

import { createWarehouse } from "@/actions/warehouses";
import { Button } from "@/components/ui/button";

import { WarehouseFields } from "./warehouse-fields";

/** S19-25: "+ Crear bodega o sucursal" abre un formulario vacío; se cierra al crear. */
export function WarehouseForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createWarehouse, null);
  // Ajuste de estado durante el render (patrón de WarehouseRow): al ver un éxito nuevo, cierra.
  // El form se desmonta al cerrar, así la próxima vez abre vacío.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setOpen(false);
  }

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>+ Crear bodega o sucursal</Button>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <h2 className="text-base font-semibold tracking-tight">Nueva bodega o sucursal</h2>
      <WarehouseFields idPrefix="new" />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear bodega o sucursal"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
