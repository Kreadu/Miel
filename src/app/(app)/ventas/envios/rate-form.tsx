"use client";

import { useActionState, useState } from "react";

import { createShippingRate } from "@/actions/shipping";
import { Button } from "@/components/ui/button";

import { RateFields } from "./rate-fields";

/** S19-35: "+ Agregar transporte" abre un formulario vacío; se cierra al crear. */
export function RateForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createShippingRate, null);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setOpen(false);
  }

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>+ Agregar transporte</Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <RateFields idPrefix="new" />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear transporte"}
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
