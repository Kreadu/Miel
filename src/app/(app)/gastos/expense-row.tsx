"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { deleteExpense } from "@/actions/expenses";
import { Button } from "@/components/ui/button";
import { categoryLabel } from "@/lib/expenses/category-label";
import { formatDate, formatMoney } from "@/lib/format";

import { ExpenseForm, type ExpenseValues } from "./expense-form";

/** S22-01: una fila de la tabla de gastos, con Editar (en el lugar) y Borrar. */
export function ExpenseRow({
  expense,
  supplierName,
  kind,
  categories,
  suppliers,
  today,
}: {
  expense: ExpenseValues;
  supplierName: string | null;
  kind: "fixed" | "variable";
  categories: string[];
  suppliers: { id: string; name: string }[];
  today: string;
}) {
  const [editing, setEditing] = useState(false);
  const close = useCallback(() => setEditing(false), []);
  const t = useTranslations();
  const te = useTranslations("expenses");

  if (editing) {
    return (
      <tr className="border-b border-border bg-muted/30">
        <td colSpan={6} className="px-3 py-4">
          <ExpenseForm
            kind={kind}
            categories={categories}
            suppliers={suppliers}
            values={expense}
            today={today}
            onDone={close}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2.5 tabular-nums">{formatDate(expense.paid_on)}</td>
      <td className="px-3 py-2.5">{categoryLabel(expense.category, te)}</td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {expense.description}
        {supplierName ? ` · ${supplierName}` : ""}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">{t(`sales.paymentMethod.${expense.method}`)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(expense.amount)}</td>
      <td className="px-3 py-2.5">
        <div className="flex justify-end gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {te("edit")}
          </Button>
          <form
            action={deleteExpense}
            onSubmit={(e) => {
              if (!confirm(te("deleteConfirm", { name: expense.description }))) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={expense.id} />
            <Button type="submit" variant="ghost" size="sm">
              {te("delete")}
            </Button>
          </form>
        </div>
      </td>
    </tr>
  );
}
