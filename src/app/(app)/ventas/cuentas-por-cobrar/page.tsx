import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { getActiveTenant } from "@/lib/tenant/server";

export const metadata = { title: "Cuentas por cobrar · Miel" };

export default async function CuentasPorCobrarPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();
  // customer_balances ya se filtra por rol admin/owner en su propia definición (member no ve
  // saldos globales, permisos-roles.md); aquí solo se evita renderizar la página a member.
  if (active.role === "member") notFound();

  const supabase = await createClient();
  const { data: balances, error } = await supabase
    .from("customer_balances")
    .select("*")
    .order("balance", { ascending: false });

  const balanceList = balances ?? [];
  const totalReceivable = balanceList.reduce((acc, curr) => {
    const bal = Number(curr.balance) || 0;
    return bal > 0 ? acc + bal : acc;
  }, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/ventas" className="text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-semibold tracking-tight">Cuentas por cobrar (CxC)</h1>
          </div>
          <p className="text-sm text-muted-foreground">Saldos pendientes de tus clientes.</p>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-2">
          <span className="text-sm text-muted-foreground">Por cobrar:</span>
          <span className="text-lg font-semibold text-destructive tabular-nums">
            {formatMoney(totalReceivable)}
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm font-medium text-destructive">No se pudieron cargar las cuentas por cobrar.</p>
          <p className="mt-1 text-xs text-muted-foreground">Intenta recargar la página.</p>
        </div>
      ) : balanceList.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Documento</th>
                <th className="px-4 py-3 text-right font-medium">Total vendido</th>
                <th className="px-4 py-3 text-right font-medium">Total cobrado</th>
                <th className="px-4 py-3 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {balanceList.map((item) => {
                const balance = Number(item.balance) || 0;
                const isDebt = balance > 0;
                const isFavor = balance < 0;

                return (
                  <tr key={item.customer_id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-sm font-medium">{item.customer_name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{item.doc_number || "—"}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {formatMoney(Number(item.total_sales) || 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
                      {formatMoney(Number(item.total_paid) || 0)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-sm font-semibold tabular-nums ${
                        isDebt ? "text-destructive" : isFavor ? "text-success" : "text-muted-foreground"
                      }`}
                    >
                      {formatMoney(Math.abs(balance))}
                      {isFavor && <span className="ml-1 text-xs font-normal">(a favor)</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No hay saldos de clientes registrados aún.</p>
        </div>
      )}
    </div>
  );
}
