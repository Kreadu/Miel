"use client";

import { useActionState, useState } from "react";

import { createWorkerCategory } from "@/actions/workers";
import { Button } from "@/components/ui/button";

import { CategoryFields } from "./category-fields";

export function CategoryForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createWorkerCategory, null);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setOpen(false);
  }

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>+ Crear categoría</Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <CategoryFields idPrefix="new" />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear categoría"}
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
