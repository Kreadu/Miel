"use client";

import { useActionState } from "react";

import { createWarehouse } from "@/actions/warehouses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WarehouseForm() {
  const [state, action, pending] = useActionState(createWarehouse, null);

  return (
    // ponytail: el campo no se limpia solo tras crear (evita el anti-patrón de
    // setState-en-efecto); el usuario ve la bodega nueva en la lista de abajo.
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="name">Nombre de la bodega</Label>
          <Input id="name" name="name" required maxLength={120} autoComplete="off" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear bodega"}
        </Button>
      </form>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
