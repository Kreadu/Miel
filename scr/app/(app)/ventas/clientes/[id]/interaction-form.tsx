"use client";

import { useActionState, useState } from "react";

import { createInteraction } from "@/actions/interactions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const KIND_LABELS: Record<string, string> = {
  note: "Nota",
  followup: "Seguimiento",
  complaint: "Reclamo",
  promo: "Promoción",
};

export function InteractionForm({ customerId }: { customerId: string }) {
  const [state, formAction, pending] = useActionState(createInteraction, null);
  const [seenState, setSeenState] = useState(state);
  const [expanded, setExpanded] = useState(false);

  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setExpanded(false);
  }

  if (!expanded) {
    return (
      <Button type="button" variant="outline" onClick={() => setExpanded(true)}>
        Registrar interacción
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <input type="hidden" name="customer_id" value={customerId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="kind">Tipo</Label>
          <select
            id="kind"
            name="kind"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            defaultValue="note"
          >
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="occurred_at">Fecha (opcional)</Label>
          <input
            id="occurred_at"
            name="occurred_at"
            type="datetime-local"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="note">Nota</Label>
          <textarea
            id="note"
            name="note"
            required
            maxLength={1000}
            rows={3}
            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar interacción"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setExpanded(false)}>
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
