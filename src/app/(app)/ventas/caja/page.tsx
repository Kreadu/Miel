import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatMoney as money } from "@/lib/format";
import { getActiveTenant } from "@/lib/tenant/server";

import { CloseSessionForm } from "./close-session-form";
import { OpenSessionForm } from "./open-session-form";

export async function generateMetadata() {
  const t = await getTranslations("cash");
  return { title: `${t("title")} · Miel` };
}

export default async function CajaPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const t = await getTranslations("cash");

  const [mySessionRes, summaryRes] = await Promise.all([
    supabase
      .from("cash_sessions")
      .select("id, opening_amount, opened_at")
      .eq("opened_by", user.id)
      .eq("status", "open")
      .maybeSingle(),
    supabase.from("cash_session_summary").select("*").order("opened_at", { ascending: false }),
  ]);

  const mySession = mySessionRes.data;
  const summaries = summaryRes.data ?? [];

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
