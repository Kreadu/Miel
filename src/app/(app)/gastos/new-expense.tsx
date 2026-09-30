"use client";

import { useCallback, useState } from "react";

import { ExpenseForm } from "./expense-form";

/** Alta de gasto: al guardar, el formulario se vuelve a montar vacío para el siguiente. */
export function NewExpense(props: {
  kind: "fixed" | "variable";
  categories: string[];
  suppliers: { id: string; name: string }[];
  today: string;
}) {
  const [key, setKey] = useState(0);
  const reset = useCallback(() => setKey((k) => k + 1), []);
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
      <ExpenseForm key={key} {...props} onDone={reset} />
    </div>
  );
}
