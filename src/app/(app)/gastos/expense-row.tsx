"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { deleteExpense, updateExpense } from "@/actions/expenses";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";

import { ExpenseForm, type ExpenseFormValues } from "./expense-form";

type ExpenseType = {
  id: string;
  kind: "fixed" | "variable";
  category: string;
  description: string;
  amount: number;
  method: "cash" | "transfer" | "card" | "other";
  paid_at: string;
  supplier_id: string | null;
  suppliers: { name: string } | null;
};

export function ExpenseRow({
  expense,
  suppliersList,
}: {
  expense: ExpenseType;
  suppliersList: Array<{ id: string; name: string }>;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const kindLabels = {
    fixed: "Fijo",
    variable: "Variable",
  };

  const methodLabels = {
    cash: "Efectivo",
    transfer: "Transferencia",
    card: "Tarjeta",
    other: "Otro",
  };

  if (isEditing) {
    const values: Partial<ExpenseFormValues> = {
      ...expense,
    };

    return (
      <tr>
        <td colSpan={7} className="p-4">
          <ExpenseForm
            action={updateExpense}
            values={values}
            suppliers={suppliersList}
            submitLabel="Guardar cambios"
            pendingLabel="Guardando…"
            onCancel={() => setIsEditing(false)}
            onSuccess={() => setIsEditing(false)}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border transition-colors hover:bg-muted/50 last:border-0">
      <td className="px-3 py-3 text-sm">
        {formatDate(expense.paid_at, { day: "2-digit", month: "short", year: "numeric" })}
      </td>
      <td className="px-3 py-3 text-sm">
        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          {kindLabels[expense.kind]}
        </span>
      </td>
      <td className="px-3 py-3 text-sm font-medium">{expense.category}</td>
      <td className="px-3 py-3 text-sm text-muted-foreground">{expense.description}</td>
      <td className="px-3 py-3 text-sm tabular-nums">
        {formatMoney(expense.amount, {
          style: "currency",
          currency: "COP",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}
      </td>
      <td className="px-3 py-3 text-sm text-muted-foreground">
        {methodLabels[expense.method]}
        {expense.suppliers ? ` · ${expense.suppliers.name}` : ""}
      </td>
      <td className="px-3 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsEditing(true)}
            title="Editar gasto"
          >
            <Pencil className="size-4" />
          </Button>
          <form action={deleteExpense}>
            <input type="hidden" name="id" value={expense.id} />
            <Button
              variant="ghost"
              size="icon"
              type="submit"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="Eliminar gasto"
            >
              <Trash2 className="size-4" />
            </Button>
          </form>
        </div>
      </td>
    </tr>
  );
}
