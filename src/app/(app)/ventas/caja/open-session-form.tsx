"use client";

import { useActionState } from "react";

import { openCashSession } from "@/actions/cash-sessions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OpenSessionForm() {
  const [state, formAction, pending] = useActionState(openCashSession, null);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-col gap-2 max-w-xs">
        <Label htmlFor="opening_amount">Monto base de caja</Label>
        <Input id="opening_amount" name="opening_amount" type="number" step="0.01" min="0" required />
        <p className="text-xs text-muted-foreground">
          El dinero con el que arrancas el turno, para poder dar cambio.
        </p>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Abriendo…" : "Abrir caja"}
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
