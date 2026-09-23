"use client";

import { useActionState, useState } from "react";

import { type ExpenseState } from "@/actions/expenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDatetimeLocalValue } from "@/lib/format";

export type ExpenseFormValues = {
  id: string;
  kind: "fixed" | "variable";
  category: string;
  description: string;
  amount: number;
  method: "cash" | "transfer" | "card" | "other";
  paid_at?: string;
  supplier_id?: string | null;
};

export function ExpenseForm({
  action,
  values,
  suppliers,
  submitLabel,
  pendingLabel,
  onCancel,
  onSuccess,
}: {
  action: (state: ExpenseState, formData: FormData) => Promise<ExpenseState>;
  values?: Partial<ExpenseFormValues>;
  suppliers: Array<{ id: string; name: string }>;
  submitLabel: string;
  pendingLabel: string;
  onCancel?: () => void;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [seenState, setSeenState] = useState(state);
  
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) onSuccess?.();
  }

  // Workaround since Radix Select does not allow empty string value natively.
  // We use "__none__" and handle it in the Server Action.
  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="kind">Tipo</Label>
          <Select name="kind" defaultValue={values?.kind || "fixed"} required>
            <SelectTrigger id="kind">
              <SelectValue placeholder="Selecciona tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fijo</SelectItem>
              <SelectItem value="variable">Variable</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="category">Categoría</Label>
          <Input id="category" name="category" required maxLength={100} defaultValue={values?.category} placeholder="Ej: Arriendo, Fletes, Nómina" />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="description">Descripción</Label>
          <Input id="description" name="description" required maxLength={200} defaultValue={values?.description} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="amount">Monto</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={values?.amount}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="method">Método de pago</Label>
          <Select name="method" defaultValue={values?.method || "transfer"} required>
            <SelectTrigger id="method">
              <SelectValue placeholder="Selecciona método" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Efectivo</SelectItem>
              <SelectItem value="transfer">Transferencia</SelectItem>
              <SelectItem value="card">Tarjeta</SelectItem>
              <SelectItem value="other">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="paid_at">Fecha de pago</Label>
          <Input
            id="paid_at"
            name="paid_at"
            type="datetime-local"
            defaultValue={toDatetimeLocalValue(values?.paid_at)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="supplier_id">Proveedor (opcional)</Label>
          <Select name="supplier_id" defaultValue={values?.supplier_id || "__none__"}>
            <SelectTrigger id="supplier_id">
              <SelectValue placeholder="Ninguno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Ninguno</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
