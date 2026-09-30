"use client";

import { useActionState, useState } from "react";

import { createWorker } from "@/actions/workers";
import { Button } from "@/components/ui/button";

import { WorkerFields } from "./worker-fields";

type Option = { id: string; name: string };

export function WorkerForm({ categories, warehouses }: { categories: Option[]; warehouses: Option[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createWorker, null);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setOpen(false);
  }

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>+ Agregar trabajador</Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <WorkerFields idPrefix="new" categories={categories} warehouses={warehouses} />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar trabajador"}
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
