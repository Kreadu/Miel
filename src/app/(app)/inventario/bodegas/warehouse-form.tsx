"use client";

import { useActionState } from "react";

import { createWarehouse } from "@/actions/warehouses";
import { Button } from "@/components/ui/button";

import { WarehouseFields } from "./warehouse-fields";

export function WarehouseForm() {
  const [state, action, pending] = useActionState(createWarehouse, null);

  return (
    // ponytail: los campos no se limpian solos tras crear (evita el anti-patrón de
    // setState-en-efecto); el usuario ve la bodega o sucursal nueva en la lista de abajo.
    <form
      action={action}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <WarehouseFields idPrefix="new" />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear bodega o sucursal"}
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
