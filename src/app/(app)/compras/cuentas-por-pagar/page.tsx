import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { getActiveTenant } from "@/lib/tenant/server";

export const metadata = { title: "Cuentas por Pagar · Miel" };

export default async function CuentasPorPagarPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const supabase = await createClient();
  const { data: balances, error } = await supabase
    .from("supplier_balances")
    .select("*")
    .order("balance", { ascending: false });

  if (error) {
    console.error("Error fetching supplier balances", error);
  }

  const balanceList = balances ?? [];
  
  // Calculate total global debt
  const totalDebt = balanceList.reduce((acc, curr) => {
    // Only sum positive balances (what we owe)
    const bal = Number(curr.balance) || 0;
    return bal > 0 ? acc + bal : acc;
  }, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/compras" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-semibold tracking-tight">Cuentas por Pagar (CxP)</h1>
          </div>
          <p className="text-sm text-muted-foreground">Saldos pendientes con proveedores.</p>
        </div>
        <div className="flex items-center gap-4 bg-muted/30 px-4 py-2 rounded-lg border border-border">
          <span className="text-sm text-muted-foreground">Deuda Total:</span>
          <span className="text-lg font-semibold text-destructive tabular-nums">
            ${formatMoney(totalDebt)}
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm font-medium text-destructive">No se pudieron cargar las cuentas por pagar.</p>
          <p className="text-xs text-muted-foreground mt-1">Intenta recargar la página.</p>
        </div>
      ) : balanceList.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Proveedor</th>
                <th className="px-4 py-3 font-medium">NIT</th>
                <th className="px-4 py-3 text-right font-medium">Total Comprado</th>
                <th className="px-4 py-3 text-right font-medium">Total Pagado</th>
                <th className="px-4 py-3 text-right font-medium">Saldo Pendiente</th>
                <th className="px-4 py-3 text-center font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {balanceList.map((item) => {
                const balance = Number(item.balance) || 0;
                // If balance is negative, it's a balance in favor
                const isDebt = balance > 0;
                const isFavor = balance < 0;

                return (
                  <tr key={item.supplier_id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">{item.supplier_name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{item.supplier_nit || "—"}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">
                      ${formatMoney(item.total_purchases || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-muted-foreground tabular-nums">
                      ${formatMoney(item.total_paid || 0)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-semibold tabular-nums ${isDebt ? 'text-destructive' : isFavor ? 'text-success' : 'text-muted-foreground'}`}>
                      ${formatMoney(Math.abs(balance))}
                      {isFavor && <span className="text-xs ml-1 font-normal">(A favor)</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/compras/proveedores/${item.supplier_id}/cuenta`}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        Detalle
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No hay saldos de proveedores registrados aún.
          </p>
        </div>
      )}
    </div>
  );
}
