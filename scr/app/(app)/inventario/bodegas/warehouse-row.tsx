"use client";

import { useActionState, useState } from "react";

import { toggleWarehouseActive, updateWarehouse } from "@/actions/warehouses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WarehouseRow({
  id,
  name,
  active,
  canManage,
}: {
  id: string;
  name: string;
  active: boolean;
  canManage: boolean;
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
      <li className="flex flex-col gap-1 px-4 py-2.5">
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <Input name="name" defaultValue={name} maxLength={120} required className="h-8" />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </form>
        {state && !state.ok ? (
          <p role="alert" className="text-xs text-destructive">
            {state.error}
          </p>
        ) : null}
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between px-4 py-2.5 text-sm">
      <span className={active ? undefined : "text-muted-foreground line-through"}>{name}</span>
      {canManage ? (
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <form action={toggleWarehouseActive}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="active" value={(!active).toString()} />
            <Button type="submit" variant="ghost" size="sm">
              {active ? "Archivar" : "Reactivar"}
            </Button>
          </form>
        </div>
      ) : (
        !active && <span className="text-xs text-muted-foreground">Archivada</span>
      )}
    </li>
  );
}
