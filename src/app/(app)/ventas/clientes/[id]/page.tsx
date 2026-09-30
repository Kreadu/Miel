import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, FileText, TrendingUp, ShoppingCart, MessageSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney as baseFormatMoney } from "@/lib/format";
import { getActiveTenant } from "@/lib/tenant/server";

import { CancelSaleButton } from "../../pedidos/cancel-sale-button";
import { InteractionForm } from "./interaction-form";

export async function generateMetadata() {
  const t = await getTranslations("customers.detail");
  return { title: `${t("title")} · Miel` };
}

interface CustomerHistoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerHistoryPage({ params }: CustomerHistoryPageProps) {
  const { id } = await params;
  const { active } = await getActiveTenant();
  if (!active) notFound();
  const t = await getTranslations();
  const td = await getTranslations("customers.detail");

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

  // S19-36: historial de compras (todas sus ventas, con saldo), movido desde Pedidos.
  const { data: purchases } = await supabase
    .from("sales")
    .select("id, status, total, shipping_cost, delivery_method, receipt_number, created_at, customer_payments(amount)")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

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
            {td("totalPurchases")}
          </div>
          <div className="mt-4 text-2xl font-bold tabular-nums">
            {history.total_sales_count}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            {td("totalAmount")}
          </div>
          <div className="mt-4 text-2xl font-bold text-success tabular-nums">
            {formatMoney(Number(history.total_sales_amount))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileText className="h-4 w-4" />
            {td("avgTicket")}
          </div>
          <div className="mt-4 text-2xl font-bold tabular-nums">
            {formatMoney(Number(history.average_ticket))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {td("lastPurchase")}
          </div>
          <div className="mt-4 text-lg font-bold">
            {history.last_sale_at ? formatDate(history.last_sale_at) : "—"}
          </div>
        </div>
      </div>

      {/* S19-36: Historial de compras */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">{td("history")}</h2>
        {purchases && purchases.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{td("date")}</th>
                  <th className="px-3 py-2 font-medium">{td("receipt")}</th>
                  <th className="px-3 py-2 font-medium">{td("status")}</th>
                  <th className="px-3 py-2 font-medium">{td("delivery")}</th>
                  <th className="px-3 py-2 text-right font-medium">{td("shipping")}</th>
                  <th className="px-3 py-2 text-right font-medium">{td("total")}</th>
                  <th className="px-3 py-2 text-right font-medium">{td("balance")}</th>
                  {active.role !== "member" && <th className="px-3 py-2"><span className="sr-only">{td("actions")}</span></th>}
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => {
                  const paid = p.customer_payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
                  const balance = p.status === "cancelled" ? 0 : Number(p.total) - paid;
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2.5">{formatDate(p.created_at)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{p.receipt_number ? `#${p.receipt_number}` : "—"}</td>
                      <td className="px-3 py-2.5">{t.has(`sales.status.${p.status}`) ? t(`sales.status.${p.status}`) : p.status}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {p.delivery_method ? t(`sales.delivery.${p.delivery_method}`) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(Number(p.shipping_cost))}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(Number(p.total))}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(balance)}</td>
                      {active.role !== "member" && (
                        <td className="px-3 py-2.5">
                          {p.status !== "cancelled" && <CancelSaleButton saleId={p.id} paid={paid} receiptNumber={p.receipt_number} />}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{td("noPurchases")}</p>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-6">{td("timeline")}</h2>
        
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{td("timelineEmpty")}</p>
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
                        <span className="font-medium text-sm">{td("saleConfirmed")}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(ev.date)}</span>
                      </div>
                      <p className="text-sm mt-1 text-muted-foreground">
                        {td.rich("saleAmount", {
                          amount: formatMoney(ev.amount),
                          b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
                        })}
                        {ev.receipt ? td("receiptSuffix", { number: ev.receipt }) : ""}
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
                          {td("paymentReceived")}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDate(ev.date)}</span>
                      </div>
                      <p className="text-sm mt-1 text-muted-foreground">
                        {td.rich("paymentLine", {
                          amount: formatMoney(ev.amount),
                          method: t.has(`sales.paymentMethod.${ev.method}`) ? t(`sales.paymentMethod.${ev.method}`) : ev.method,
                          b: (chunks) => <span className="font-semibold text-success">{chunks}</span>,
                        })}
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
          <h2 className="text-lg font-semibold">{td("interactions")}</h2>
          <InteractionForm customerId={id} />
        </div>

        {!interactions || interactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {td("interactionsEmpty")}
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
                    {t.has(`interactions.kind.${it.kind}`) ? t(`interactions.kind.${it.kind}`) : it.kind}
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
