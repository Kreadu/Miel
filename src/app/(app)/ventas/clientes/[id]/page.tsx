import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, FileText, TrendingUp, ShoppingCart, MessageSquare } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney as baseFormatMoney } from "@/lib/format";
import { getActiveTenant } from "@/lib/tenant/server";

import { InteractionForm } from "./interaction-form";

const INTERACTION_KIND_LABELS: Record<string, string> = {
  note: "Nota",
  followup: "Seguimiento",
  complaint: "Reclamo",
  promo: "Promoción",
};

export const metadata = { title: "Ficha de Cliente · Miel" };

interface CustomerHistoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerHistoryPage({ params }: CustomerHistoryPageProps) {
  const { id } = await params;
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const supabase = await createClient();

  // 1. Fetch metrics from the view
  const { data: history, error: historyErr } = await supabase
    .from("customer_history")
    .select("*")
    .eq("customer_id", id)
    .single();

  if (historyErr || !history) {
    notFound();
  }

  // 2. Fetch sales for the timeline
  const { data: sales, error: salesErr } = await supabase
    .from("sales")
    .select("id, status, total, issued_at, receipt_number")
    .eq("customer_id", id)
    .in("status", ["confirmed", "shipped", "delivered"]);

  // 3. Fetch payments for the timeline
  const { data: payments, error: paymentsErr } = await supabase
    .from("customer_payments")
    .select("id, amount, method, paid_at, sale_id")
    .eq("customer_id", id);

  // 4. Fetch postsale interactions (separate timeline, S5-07)
  const { data: interactions } = await supabase
    .from("customer_interactions")
    .select("id, kind, note, occurred_at")
    .eq("customer_id", id)
    .order("occurred_at", { ascending: false });

  // Combine and sort events for the timeline
  type TimelineEvent = 
    | { type: "sale"; date: Date; id: string; status: string; amount: number; receipt: number | null }
    | { type: "payment"; date: Date; id: string; method: string; amount: number; saleId: string | null };

  const events: TimelineEvent[] = [];

  if (sales && !salesErr) {
    sales.forEach((s) => {
      events.push({
        type: "sale",
        date: new Date(s.issued_at || ""),
        id: s.id,
        status: s.status,
        amount: Number(s.total),
        receipt: s.receipt_number,
      });
    });
  }

  if (payments && !paymentsErr) {
    payments.forEach((p) => {
      events.push({
        type: "payment",
        date: new Date(p.paid_at || ""),
        id: p.id,
        method: p.method,
        amount: Number(p.amount),
        saleId: p.sale_id,
      });
    });
  }

  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  const formatMoney = (val: number) => `$${baseFormatMoney(val)}`;

  const formatDate = (d: Date | string | null) => {
    if (!d) return "—";
    return formatDateTime(d, { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2">
        <Link href="/ventas/clientes" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{history.customer_name}</h1>
          <p className="text-sm text-muted-foreground">
            {history.doc_type?.toUpperCase()} {history.doc_number || "—"}
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShoppingCart className="h-4 w-4" />
            Compras Totales
          </div>
          <div className="mt-4 text-2xl font-bold tabular-nums">
            {history.total_sales_count}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            Monto Total Comprado
          </div>
          <div className="mt-4 text-2xl font-bold text-success tabular-nums">
            {formatMoney(Number(history.total_sales_amount))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileText className="h-4 w-4" />
            Ticket Promedio
          </div>
          <div className="mt-4 text-2xl font-bold tabular-nums">
            {formatMoney(Number(history.average_ticket))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Última Compra
          </div>
          <div className="mt-4 text-lg font-bold">
            {history.last_sale_at ? formatDate(history.last_sale_at) : "—"}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-6">Línea de tiempo de ventas y pagos</h2>
        
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este cliente aún no tiene ventas ni pagos registrados.</p>
        ) : (
          <div className="relative border-l border-border ml-3 pl-6 flex flex-col gap-8">
            {events.map((ev, idx) => (
              <div key={`${ev.type}-${ev.id}-${idx}`} className="relative">
                {ev.type === "sale" ? (
                  <>
                    <div className="absolute -left-[33px] mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 ring-4 ring-card">
                      <div className="h-1.5 w-1.5 rounded-full bg-card" />
                    </div>
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="font-medium text-sm">Venta confirmada</span>
                        <span className="text-xs text-muted-foreground">{formatDate(ev.date)}</span>
                      </div>
                      <p className="text-sm mt-1 text-muted-foreground">
                        Monto: <span className="font-semibold text-foreground">{formatMoney(ev.amount)}</span>
                        {ev.receipt ? ` · Recibo #${ev.receipt}` : ""}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute -left-[33px] mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-success ring-4 ring-card">
                      <div className="h-1.5 w-1.5 rounded-full bg-card" />
                    </div>
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="font-medium text-sm flex items-center gap-1.5">
                          Pago recibido
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDate(ev.date)}</span>
                      </div>
                      <p className="text-sm mt-1 text-muted-foreground">
                        Abono de <span className="font-semibold text-success">{formatMoney(ev.amount)}</span> vía {ev.method}
                      </p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interacciones postventa (S5-07) */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Interacciones postventa</h2>
          <InteractionForm customerId={id} />
        </div>

        {!interactions || interactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay interacciones registradas con este cliente.
          </p>
        ) : (
          <div className="relative border-l border-border ml-3 pl-6 flex flex-col gap-6">
            {interactions.map((it) => (
              <div key={it.id} className="relative">
                <div className="absolute -left-[33px] mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-4 ring-card">
                  <MessageSquare className="h-2 w-2 text-primary-foreground" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <span className="font-medium text-sm">
                    {INTERACTION_KIND_LABELS[it.kind] ?? it.kind}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(it.occurred_at)}</span>
                </div>
                <p className="text-sm mt-1 text-muted-foreground">{it.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
