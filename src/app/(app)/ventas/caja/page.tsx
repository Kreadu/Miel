import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatMoney as money } from "@/lib/format";
import { cashRange } from "@/lib/cash/range";
import { todayInBogota } from "@/lib/inventory-history";
import { getActiveTenant } from "@/lib/tenant/server";

import { CloseSessionForm } from "./close-session-form";
import { OpenSessionForm } from "./open-session-form";
import { RefundForm } from "./refund-form";

export async function generateMetadata() {
  const t = await getTranslations("cash");
  return { title: `${t("title")} · Miel` };
}

export default async function CajaPage({ searchParams }: { searchParams: Promise<{ boleta?: string; desde?: string; hasta?: string }> }) {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const t = await getTranslations("cash");
  const tAll = await getTranslations();
  const canManage = active.role !== "member";
  const params = await searchParams;
  const receiptNumber = Number(params.boleta) || null;
  // S18-12: movimientos y turnos del día; con fechas, del rango (hora de Bogotá).
  const today = todayInBogota();
  const { from, to } = cashRange(params, today);

  const [mySessionRes, summaryRes] = await Promise.all([
    supabase
      .from("cash_sessions")
      .select("id, opening_amount, opened_at")
      .eq("tenant_id", active.tenantId)
      .eq("opened_by", user.id)
      .eq("status", "open")
      .maybeSingle(),
    supabase
      .from("cash_session_summary")
      .select("*")
      .eq("tenant_id", active.tenantId)
      .gte("opened_at", `${from}T00:00:00-05:00`)
      .lte("opened_at", `${to}T23:59:59.999-05:00`)
      .order("opened_at", { ascending: false }),
  ]);

  const mySession = mySessionRes.data;
  const summaries = summaryRes.data ?? [];

  // S18-08: movimientos de mi turno (cobros y devoluciones), solo lectura.
  const [movementsRes, refundSaleRes] = await Promise.all([
    // S18-12: por defecto lo de hoy; con fechas, el rango. Un operativo ve solo sus cobros.
    (() => {
      let q = supabase
        .from("customer_payments")
        .select("id, amount, method, paid_at, note, created_by, customers(name), sales(receipt_number, sale_items(qty, products(name)))")
        .eq("tenant_id", active.tenantId)
        .gte("paid_at", `${from}T00:00:00-05:00`)
        .lte("paid_at", `${to}T23:59:59.999-05:00`)
        .order("paid_at", { ascending: false })
        .limit(500);
      if (!canManage) q = q.eq("created_by", user.id);
      return q;
    })(),
    canManage && receiptNumber
      ? supabase
          .from("sales")
          .select("id, status, total, issued_at, customers(name), sale_items(qty, products(name)), customer_payments(amount)")
          .eq("tenant_id", active.tenantId)
          .eq("receipt_number", receiptNumber)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const movements = movementsRes.data ?? [];
  const byMethod = movements.reduce<Record<string, number>>((acc, m) => {
    acc[m.method] = (acc[m.method] ?? 0) + Number(m.amount);
    return acc;
  }, {});
  const refundSaleRow = refundSaleRes.data;
  // Quién cobró (dueño/admin): su nombre de RRHH (S26-08).
  const { data: members } = canManage
    ? await supabase.from("memberships").select("user_id, display_name").eq("tenant_id", active.tenantId)
    : { data: [] };
  const namesByUser = new Map((members ?? []).filter((m) => m.display_name).map((m) => [m.user_id, m.display_name!]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{active.tenantName}</p>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {mySession ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {t.rich("openSince", {
              date: formatDateTime(mySession.opened_at),
              amount: `$${money(mySession.opening_amount)}`,
              b: (chunks) => <span className="font-medium tabular-nums">{chunks}</span>,
            })}
          </p>
          <CloseSessionForm sessionId={mySession.id} />

        </div>
      ) : (
        <OpenSessionForm />
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight">
            {from === to && from === today ? t("movements.today") : t("movements.range", { from, to })}
          </h2>
          <p className="text-xs text-muted-foreground">{t("movements.readOnly")}</p>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="desde" className="text-xs font-medium">{t("movements.from")}</label>
            <input id="desde" name="desde" type="date" defaultValue={from} className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="hasta" className="text-xs font-medium">{t("movements.to")}</label>
            <input id="hasta" name="hasta" type="date" defaultValue={to} className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm" />
          </div>
          <button type="submit" className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent">
            {t("movements.view")}
          </button>
          {from !== today || to !== today ? (
            <a href="/ventas/caja" className="inline-flex h-9 items-center text-sm underline underline-offset-4">
              {t("movements.backToToday")}
            </a>
          ) : null}
        </form>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["cash", "card", "transfer", "other"] as const).map((m) => (
            <div key={m} className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">{tAll(`sales.paymentMethod.${m}`)}</p>
              <p className="text-base font-semibold tabular-nums">${money(byMethod[m] ?? 0)}</p>
            </div>
          ))}
        </div>
        {movements.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t("movements.time")}</th>
                  <th className="px-3 py-2 font-medium">{t("movements.customer")}</th>
                  <th className="px-3 py-2 font-medium">{t("movements.receipt")}</th>
                  <th className="px-3 py-2 font-medium">{t("movements.method")}</th>
                  {canManage ? <th className="px-3 py-2 font-medium">{t("movements.who")}</th> : null}
                  <th className="px-3 py-2 text-right font-medium">{t("movements.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const lines = (m.sales?.sale_items ?? [])
                    .map((it) => `${Number(it.qty).toLocaleString("es-CO")} × ${it.products?.name ?? "—"}`)
                    .join(", ");
                  return (
                    <tr key={m.id} className="border-b border-border align-top last:border-0">
                      <td className="px-3 py-2 tabular-nums">{formatDateTime(m.paid_at)}</td>
                      <td className="px-3 py-2">
                        {m.customers?.name ?? "—"}
                        {lines ? <span className="block text-xs text-muted-foreground">{lines}</span> : null}
                        {Number(m.amount) < 0 && m.note ? (
                          <span className="block text-xs text-destructive">{m.note}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {m.sales?.receipt_number ? `#${m.sales.receipt_number}` : "—"}
                      </td>
                      <td className="px-3 py-2">{tAll(`sales.paymentMethod.${m.method}`)}</td>
                      {canManage ? (
                        <td className="px-3 py-2 text-muted-foreground">
                          {m.created_by === user.id ? t("you") : (namesByUser.get(m.created_by) ?? t("otherUser"))}
                        </td>
                      ) : null}
                      <td className={`px-3 py-2 text-right tabular-nums ${Number(m.amount) < 0 ? "text-destructive" : ""}`}>
                        ${money(Number(m.amount))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("movements.empty")}
          </p>
        )}
      </section>

      {canManage ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div>
            <h2 className="text-base font-semibold tracking-tight">{t("refund.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("refund.help")}</p>
          </div>
          {mySession ? (
            <>
              <form method="get" className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="boleta" className="text-sm font-medium">
                    {t("refund.receipt")}
                  </label>
                  <input
                    id="boleta"
                    name="boleta"
                    type="number"
                    min={1}
                    required
                    defaultValue={receiptNumber ?? undefined}
                    className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent"
                >
                  {t("refund.search")}
                </button>
              </form>
              {receiptNumber && !refundSaleRow ? (
                <p className="text-sm text-destructive">{t("refund.notFound")}</p>
              ) : null}
              {refundSaleRow ? (
                <div className="flex flex-col gap-3 rounded-md border border-border p-3">
                  <p className="text-sm">
                    <span className="font-medium">{t("refund.saleLine", { number: receiptNumber ?? 0 })}</span>
                    {" · "}
                    {refundSaleRow.customers?.name ?? "—"} · ${money(refundSaleRow.total)}
                    {refundSaleRow.issued_at ? ` · ${formatDate(refundSaleRow.issued_at)}` : ""}
                  </p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {refundSaleRow.sale_items.map((it, i) => (
                      <li key={i}>
                        {it.qty} × {it.products?.name ?? "—"}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-muted-foreground">
                    {t("refund.paid", {
                      amount: `$${money(refundSaleRow.customer_payments.reduce((sum, p) => sum + Number(p.amount), 0))}`,
                    })}
                  </p>
                  {refundSaleRow.status === "cancelled" ? (
                    <p className="text-sm text-destructive">{tAll("sales.errors.alreadyCancelled")}</p>
                  ) : (
                    <RefundForm key={refundSaleRow.id} receiptNumber={receiptNumber ?? 0} />
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("refund.openFirst")}</p>
          )}
        </section>
      ) : null}

      {summaries.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("shift")}</th>
                <th className="px-3 py-2 font-medium">{t("status")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("base")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("sales")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("cash")}</th>
                <th className="px-3 py-2 text-right font-medium">{tAll("sales.paymentMethod.card")}</th>
                <th className="px-3 py-2 text-right font-medium">{tAll("sales.paymentMethod.transfer")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("expected")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("counted")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("difference")}</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.cash_session_id} className="border-b border-border last:border-0 text-sm">
                  <td className="px-3 py-2">
                    {s.opened_by === user.id ? t("you") : t("otherUser")} ·{" "}
                    {formatDate(s.opened_at!)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        s.status === "open"
                          ? "rounded-sm bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                          : "rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {s.status === "open" ? t("open") : t("closed")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">${money(s.opening_amount ?? 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${money(s.sales_total ?? 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${money(s.cash_total ?? 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${money(s.card_total ?? 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${money(s.transfer_total ?? 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s.expected_amount != null ? `$${money(s.expected_amount)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s.counted_amount != null ? `$${money(s.counted_amount)}` : "—"}
                  </td>
                  <td
                    className={
                      "px-3 py-2 text-right tabular-nums" +
                      (s.difference != null && s.difference !== 0 ? " text-destructive" : "")
                    }
                  >
                    {s.difference != null ? `$${money(s.difference)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      )}
    </div>
  );
}
