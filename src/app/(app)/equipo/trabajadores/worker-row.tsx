"use client";

import { useActionState, useState } from "react";

import { toggleWorkerActive, updateWorker } from "@/actions/workers";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { CONTRACT_TYPES } from "@/lib/rrhh/workers";

import { WorkerFields, type WorkerValues } from "./worker-fields";

type Option = { id: string; name: string };

export function WorkerRow({
  id,
  active,
  values,
  categories,
  warehouses,
}: {
  id: string;
  active: boolean;
  values: WorkerValues;
  categories: Option[];
  warehouses: Option[];
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateWorker, null);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setEditing(false);
  }

  if (editing) {
    return (
      <li className="px-4 py-4">
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          <WorkerFields idPrefix={id} values={values} categories={categories} warehouses={warehouses} />
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

  const category = categories.find((c) => c.id === values.category_id)?.name;

  return (
    <li className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={active ? "font-medium" : "text-muted-foreground line-through"}>
          {values.full_name}
          {category ? (
            <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-secondary-foreground">
              {category}
            </span>
          ) : null}
        </span>
        <span className="text-xs text-muted-foreground">
          {[
            values.position,
            CONTRACT_TYPES[values.contract_type as keyof typeof CONTRACT_TYPES],
            `Salario ${formatMoney(values.salary)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {active ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
        ) : null}
        <form
          action={toggleWorkerActive}
          onSubmit={(e) => {
            if (active && !confirm(`¿Retirar a "${values.full_name}"?`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="active" value={(!active).toString()} />
          <Button type="submit" variant="ghost" size="sm">
            {active ? "Retirar" : "Reactivar"}
          </Button>
        </form>
      </div>
    </li>
  );
}
