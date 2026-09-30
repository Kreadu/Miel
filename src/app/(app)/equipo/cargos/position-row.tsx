"use client";

import { useActionState, useState } from "react";

import { deleteWorkerPosition, updateWorkerPosition } from "@/actions/workers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PositionRow({ id, name, workerCount }: { id: string; name: string; workerCount: number }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateWorkerPosition, null);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setEditing(false);
  }

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="id" value={id} />
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={`position-${id}`} className="sr-only">
              Nombre del cargo
            </Label>
            <Input id={`position-${id}`} name="name" required maxLength={80} defaultValue={name} />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </form>
        {state && !state.ok ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {state.error}
          </p>
        ) : null}
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
      <span className="font-medium">
        {name} <span className="text-xs font-normal text-muted-foreground">· {workerCount} trabajadores</span>
      </span>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Editar
        </Button>
        <form
          action={deleteWorkerPosition}
          onSubmit={(e) => {
            if (!confirm(`¿Borrar el cargo "${name}"? Sus trabajadores quedan sin cargo.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="ghost" size="sm">
            Borrar
          </Button>
        </form>
      </div>
    </li>
  );
}
