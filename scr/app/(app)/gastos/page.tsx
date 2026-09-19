import { notFound } from "next/navigation";

import { createExpense } from "@/actions/expenses";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { ExpenseForm } from "./expense-form";
import { ExpenseRow } from "./expense-row";

export const metadata = { title: "Gastos · Miel" };

export default async function GastosPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  if (active.role === "member") {
    notFound();
  }

  const supabase = await createClient();
  
  const [expensesRes, suppliersRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, kind, category, description, amount, method, paid_at, supplier_id, suppliers(name)")
      .order("paid_at", { ascending: false }),
    supabase
      .from("suppliers")
      .select("id, name")
      .eq("active", true)
      .order("name", { ascending: true }),
  ]);

  const expenses = expensesRes.data || [];
  const suppliers = suppliersRes.data || [];

  // Ajuste en caso de que supabase devuelva supplier_id como objeto por culpa de relaciones en TS
  const safeExpenses = expenses.map((e) => ({
    ...e,
    suppliers: Array.isArray(e.suppliers) ? e.suppliers[0] : e.suppliers,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Gastos</h1>
        <p className="text-sm text-muted-foreground">
          Gastos fijos y variables para operar y administrar tu negocio.
        </p>
      </div>

      <ExpenseForm
        action={createExpense}
        suppliers={suppliers}
        submitLabel="Registrar gasto"
        pendingLabel="Registrando…"
      />

      {safeExpenses.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Categoría</th>
                <th className="px-3 py-2 font-medium">Descripción</th>
                <th className="px-3 py-2 font-medium">Monto</th>
                <th className="px-3 py-2 font-medium">Método</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {safeExpenses.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  // @ts-expect-error supabase type assertion
                  expense={expense}
                  suppliersList={suppliers}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aún no has registrado gastos. Registra el primero arriba.
        </p>
      )}
    </div>
  );
}
