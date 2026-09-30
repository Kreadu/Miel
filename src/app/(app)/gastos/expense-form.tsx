"use client";

import { useActionState, useEffect } from "react";

import { createExpense, updateExpense } from "@/actions/expenses";
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

import { CategorySelect } from "./category-select";

const NONE = "__none__";

export const METHOD_LABEL = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  other: "Otro",
} as const;

export type ExpenseValues = {
  id: string;
  category: string;
  description: string;
  amount: number;
  method: keyof typeof METHOD_LABEL;
  paid_on: string;
  supplier_id: string | null;
};

/** S22-01: formulario de gasto de una hoja (fija o variable). Sin `values` es un alta. */
export function ExpenseForm({
  kind,
  categories,
  suppliers,
  values,
  today,
  onDone,
}: {
  kind: "fixed" | "variable";
  categories: string[];
  suppliers: { id: string; name: string }[];
  values?: ExpenseValues;
  today: string;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(values ? updateExpense : createExpense, null);
  const id = (f: string) => `${values?.id ?? "new"}-${f}`;

  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {values ? <input type="hidden" name="id" value={values.id} /> : null}
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CategorySelect id={id("category")} kind={kind} categories={categories} defaultValue={values?.category} />
        <div className="flex flex-col gap-2 lg:col-span-2">
          <Label htmlFor={id("description")}>Descripción</Label>
          <Input
            id={id("description")}
            name="description"
            required
            maxLength={300}
            placeholder="Ej. Arriendo local de septiembre"
            defaultValue={values?.description}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("amount")}>Monto</Label>
          <Input
            id={id("amount")}
            name="amount"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={values?.amount}
            className="text-right"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("paid_on")}>Fecha</Label>
          <Input id={id("paid_on")} name="paid_on" type="date" required defaultValue={values?.paid_on ?? today} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("method")}>Forma de pago</Label>
          <Select name="method" defaultValue={values?.method ?? "transfer"}>
            <SelectTrigger id={id("method")} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(METHOD_LABEL).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2 lg:col-span-3">
          <Label htmlFor={id("supplier")}>Proveedor (opcional)</Label>
          <Select name="supplier_id" defaultValue={values?.supplier_id ?? NONE}>
            <SelectTrigger id={id("supplier")} className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin proveedor</SelectItem>
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
          {pending ? "Guardando…" : values ? "Guardar cambios" : "Agregar gasto"}
        </Button>
        {values ? (
          <Button type="button" variant="ghost" onClick={onDone}>
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
