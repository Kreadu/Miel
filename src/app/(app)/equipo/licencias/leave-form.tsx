"use client";

import { useActionState, useState } from "react";

import { createLeave } from "@/actions/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAVE_TYPES } from "@/lib/rrhh/payroll-input";

/** S21-05: registrar una licencia o incapacidad. */
export function LeaveForm({ workers }: { workers: { id: string; full_name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createLeave, null);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setOpen(false);
  }

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>+ Registrar licencia</Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="leave-worker">Trabajador</Label>
          <Select name="worker_id" required>
            <SelectTrigger id="leave-worker" className="w-full">
              <SelectValue placeholder="Elige un trabajador" />
            </SelectTrigger>
            <SelectContent>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="leave-type">Tipo</Label>
          <Select name="type" required>
            <SelectTrigger id="leave-type" className="w-full">
              <SelectValue placeholder="Elige el tipo" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LEAVE_TYPES).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="leave-start">Desde</Label>
          <Input id="leave-start" name="start_date" type="date" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="leave-end">Hasta</Label>
          <Input id="leave-end" name="end_date" type="date" required />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="leave-note">Nota (opcional)</Label>
          <Input id="leave-note" name="note" maxLength={300} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar licencia"}
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
