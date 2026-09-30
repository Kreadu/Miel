"use client";

import { useActionState, useState } from "react";

import { deleteWorkerCategory, updateWorkerCategory } from "@/actions/workers";
import { Button } from "@/components/ui/button";
import { WORKER_MODULES } from "@/lib/rrhh/workers";

import { CategoryFields } from "./category-fields";

export function CategoryRow({
  id,
  name,
  modules,
  workerCount,
}: {
  id: string;
  name: string;
  modules: string[];
  workerCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateWorkerCategory, null);
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
          <CategoryFields idPrefix={id} name={name} modules={modules} />
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

  const labels = WORKER_MODULES.filter((m) => modules.includes(m.id)).map((m) => m.label);

  return (
    <li className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">
          {name} <span className="text-xs font-normal text-muted-foreground">· {workerCount} trabajadores</span>
        </span>
        <span className="text-xs text-muted-foreground">
          {labels.length > 0 ? `Ve: ${labels.join(", ")}` : "No ve ningún módulo todavía"}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Editar
        </Button>
        <form
          action={deleteWorkerCategory}
          onSubmit={(e) => {
            if (!confirm(`¿Eliminar "${name}"? Sus trabajadores quedan sin categoría.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="ghost" size="sm">
            Eliminar
          </Button>
        </form>
      </div>
    </li>
  );
}
