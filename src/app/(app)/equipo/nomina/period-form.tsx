"use client";

import { useActionState, useState } from "react";

import { createPayrollPeriod } from "@/actions/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** S21-05: nuevo período (por defecto, el mes en curso). Al crearlo se liquida a todos. */
export function PeriodForm({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createPayrollPeriod, null);

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>+ Nuevo período de nómina</Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-md">
        <div className="flex flex-col gap-2">
          <Label htmlFor="period-start">Desde</Label>
          <Input id="period-start" name="period_start" type="date" required defaultValue={defaultStart} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="period-end">Hasta</Label>
          <Input id="period-end" name="period_end" type="date" required defaultValue={defaultEnd} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Se liquida a todos los trabajadores activos (menos prestación de servicios), con sus licencias.
        Después puedes ajustar días, horas extra y horas trabajadas.
      </p>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Liquidando…" : "Crear y liquidar"}
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
