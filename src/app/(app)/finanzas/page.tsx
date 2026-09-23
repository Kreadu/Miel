import { notFound } from "next/navigation";
import { getActiveTenant } from "@/lib/tenant/server";
import { createClient } from "@/lib/supabase/server";
import { PnlChart } from "./pnl-chart";
import { CashFlowChart } from "./cash-flow-chart";
import { ExpensesChart } from "./expenses-chart";

export const metadata = { title: "Finanzas · Miel" };

export default async function FinanzasPage() {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") {
    notFound();
  }

  const supabase = await createClient();

  const [pnlRes, cashRes, expensesRes] = await Promise.all([
    supabase.from("monthly_pnl").select("*").order("month", { ascending: true }),
    supabase.from("cash_flow").select("*").order("month", { ascending: true }),
    supabase.from("monthly_expenses").select("*").order("month", { ascending: true }),
  ]);

  if (pnlRes.error) throw pnlRes.error;
  if (cashRes.error) throw cashRes.error;
  if (expensesRes.error) throw expensesRes.error;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Finanzas</h1>
        <p className="text-sm text-muted-foreground">
          Rentabilidad, gastos y flujo de caja gerencial.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <PnlChart data={pnlRes.data} />
        <CashFlowChart data={cashRes.data} />
      </div>
      
      <div className="grid gap-6">
        <ExpensesChart data={expensesRes.data} />
      </div>
    </div>
  );
}
