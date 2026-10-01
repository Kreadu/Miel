import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatMoney } from "@/lib/format";
import { historyFilters, todayInBogota } from "@/lib/inventory-history";
import { salesHistoryTotals } from "@/lib/sales/history";
import { createClient } from "@/lib/supabase/server";

export type SalesHistoryParams = { historial?: string; desde?: string; hasta?: string; estado?: string };

const BASE_PATH = "/ventas/pedidos";
const STATUS_FILTERS = ["all", "pending", "delivered", "cancelled"] as const;
const STATUSES_BY_FILTER: Record<(typeof STATUS_FILTERS)[number], string[] | null> = {
  all: null,
  pending: ["draft", "confirmed", "shipped"],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
};

/**
 * S18-11: historial de pedidos — cerrado hasta apretar "Historial"; rango de fechas (hora de
 * Bogotá, por defecto el mes en curso) y estado, con un formulario GET (todo en el servidor).
 */
export async function SalesHistory({ tenantId, params }: { tenantId: string; params: SalesHistoryParams }) {
  const t = await getTranslations("sales");
  if (params.historial !== "1") {
    return (
      <div>
        <Button asChild variant="outline">
          <Link href={`${BASE_PATH}?historial=1`}>{t("history.open")}</Link>
        </Button>
      </div>
    );
  }

  const { from, to } = historyFilters({ desde: params.desde, hasta: params.hasta }, todayInBogota());
  const filter = (STATUS_FILTERS as readonly string[]).includes(params.estado ?? "")
    ? (params.estado as (typeof STATUS_FILTERS)[number])
    : "all";

  const supabase = await createClient();
  let query = supabase
    .from("sales")
    .select("id, status, total, receipt_number, document_type, created_at, customer_id, customers(name), customer_payments(amount)")
    .eq("tenant_id", tenantId)
    .gte("created_at", `${from}T00:00:00-05:00`)
    .lte("created_at", `${to}T23:59:59.999-05:00`)
    .order("created_at", { ascending: false })
    .limit(500);
  const statuses = STATUSES_BY_FILTER[filter];
  if (statuses) query = query.in("status", statuses);
  const { data } = await query;
  const rows = (data ?? []).map((s) => ({
    ...s,
    total: Number(s.total),
    paid: s.customer_payments.reduce((sum, p) => sum + Number(p.amount), 0),
  }));
  const totals = salesHistoryTotals(rows);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">{t("history.title")}</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href={BASE_PATH}>{t("history.close")}</Link>
        </Button>
      </div>

      <form method="get" action={BASE_PATH} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-4">
        <input type="hidden" name="historial" value="1" />
        <div className="flex flex-col gap-2">
          <Label htmlFor="desde">{t("history.from")}</Label>
          <Input id="desde" name="desde" type="date" defaultValue={from} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hasta">{t("history.to")}</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={to} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="estado">{t("history.status")}</Label>
          <Select name="estado" defaultValue={filter}>
            <SelectTrigger id="estado" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f} value={f}>
                  {t(`history.filters.${f}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit">{t("history.view")}</Button>
      </form>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("orders.date")}</th>
                <th className="px-3 py-2 font-medium">{t("history.receipt")}</th>
                <th className="px-3 py-2 font-medium">{t("orders.customer")}</th>
                <th className="px-3 py-2 font-medium">{t("orders.status")}</th>
                <th className="px-3 py-2 font-medium">{t("history.document")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("orders.total")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("history.collected")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 tabular-nums">{formatDate(r.created_at)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{r.receipt_number ? `#${r.receipt_number}` : "—"}</td>
                  <td className="px-3 py-2.5">
                    {r.customer_id ? (
                      <Link href={`/ventas/clientes/${r.customer_id}`} className="underline-offset-4 hover:underline">
                        {r.customers?.name ?? "—"}
                      </Link>
                    ) : (
                      (r.customers?.name ?? "—")
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {t.has(`status.${r.status}`) ? t(`status.${r.status}`) : r.status}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {t.has(`cart.documentTypes.${r.document_type}`) ? t(`cart.documentTypes.${r.document_type}`) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(r.total)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(r.paid)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="px-3 py-2.5" colSpan={5}>
                  {t("history.totals")}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(totals.sold)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(totals.collected)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t("history.empty")}
        </p>
      )}
    </section>
  );
}
