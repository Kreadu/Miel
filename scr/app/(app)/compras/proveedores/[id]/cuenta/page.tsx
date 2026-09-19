import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getActiveTenant } from "@/lib/tenant/server";

export const metadata = { title: "Cuenta de Proveedor · Miel" };

interface PageProps {
  params: Promise<{ id: string }>;
}

type LedgerEntry = {
  id: string;
  date: Date;
  type: "purchase" | "payment";
  description: string;
  debit: number; // Incrementa la deuda (compra)
  credit: number; // Disminuye la deuda (pago)
  balance: number; // Running balance
  status?: string;
  method?: string;
  note?: string | null;
};

export default async function SupplierAccountPage({ params }: PageProps) {
  const { id } = await params;
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const supabase = await createClient();

  const [supplierRes, purchasesRes, paymentsRes] = await Promise.all([
    supabase.from("suppliers").select("name, nit").eq("id", id).single(),
    supabase.from("purchases").select("id, status, total, created_at").eq("supplier_id", id).in("status", ["ordered", "received"]),
    supabase.from("supplier_payments").select("id, amount, method, note, paid_at, purchase_id").eq("supplier_id", id)
  ]);

  if (supplierRes.error || !supplierRes.data) {
    notFound();
  }

  const supplier = supplierRes.data;
  const purchases = purchasesRes.data || [];
  const payments = paymentsRes.data || [];

  // Build the ledger
  const entries: Omit<LedgerEntry, "balance">[] = [];

  purchases.forEach((p) => {
    entries.push({
      id: p.id,
      date: new Date(p.created_at),
      type: "purchase",
      description: "Orden de Compra",
      debit: Number(p.total),
      credit: 0,
      status: p.status
    });
  });

  payments.forEach((p) => {
    entries.push({
      id: p.id,
      date: new Date(p.paid_at),
      type: "payment",
      description: p.purchase_id ? "Abono a compra" : "Abono general / Anticipo",
      debit: 0,
      credit: Number(p.amount),
      method: p.method,
      note: p.note
    });
  });

  // Sort by date ascending (oldest first) to calculate running balance
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  let currentBalance = 0;
  const ledger: LedgerEntry[] = entries.map((entry) => {
    currentBalance += entry.debit - entry.credit;
    return {
      ...entry,
      balance: currentBalance
    };
  });

  // Sort descending for display (newest first)
  ledger.reverse();

  const finalBalance = currentBalance;
  const isDebt = finalBalance > 0;
  const isFavor = finalBalance < 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/compras/cuentas-por-pagar" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-semibold tracking-tight">Cuenta de Proveedor</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {supplier.name} {supplier.nit ? `(NIT: ${supplier.nit})` : ""}
          </p>
        </div>
        <div className="flex items-center gap-4 bg-muted/30 px-4 py-2 rounded-lg border border-border">
          <span className="text-sm text-muted-foreground">Saldo Actual:</span>
          <span className={`text-xl font-semibold tabular-nums ${isDebt ? 'text-destructive' : isFavor ? 'text-success' : ''}`}>
            ${formatMoney(Math.abs(finalBalance))}
            {isFavor && <span className="text-xs ml-1 font-normal text-muted-foreground">(A favor)</span>}
          </span>
        </div>
      </div>

      {ledger.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 text-right font-medium text-destructive/80">Cargo (Compra)</th>
                <th className="px-4 py-3 text-right font-medium text-success/80">Abono (Pago)</th>
                <th className="px-4 py-3 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => {
                const bal = entry.balance;
                const isBalDebt = bal > 0;
                const isBalFavor = bal < 0;

                return (
                  <tr key={`${entry.type}-${entry.id}`} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-muted-foreground">
                      {formatDateTime(entry.date, { year: "numeric", month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {entry.type === "purchase" ? (
                          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </div>
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-success/10 text-success">
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{entry.description}</p>
                          {(entry.status || entry.method || entry.note) && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {entry.type === "purchase" 
                                ? `Estado: ${entry.status}` 
                                : `Método: ${entry.method}${entry.note ? ` · ${entry.note}` : ""}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium tabular-nums">
                      {entry.debit > 0 ? (
                        <span className="text-destructive">
                          ${formatMoney(entry.debit)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium tabular-nums">
                      {entry.credit > 0 ? (
                        <span className="text-success">
                          ${formatMoney(entry.credit)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-semibold tabular-nums ${isBalDebt ? '' : isBalFavor ? 'text-success' : 'text-muted-foreground'}`}>
                      ${formatMoney(Math.abs(bal))}
                      {isBalFavor && <span className="text-xs ml-1 font-normal text-muted-foreground">(F)</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-8 text-center flex flex-col items-center justify-center">
          <FileText className="h-8 w-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium">Sin movimientos</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Este proveedor no tiene compras procesadas ni pagos registrados en su cuenta.
          </p>
        </div>
      )}
    </div>
  );
}
