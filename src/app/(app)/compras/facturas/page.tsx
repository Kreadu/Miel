import { ArrowLeft, Download, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatMoney } from "@/lib/format";
import { todayInBogota } from "@/lib/inventory-history";
import { type InvoiceListParams, invoiceFilters, invoicesTotals } from "@/lib/purchases/invoice-list";
import { loadInvoiceRows } from "@/lib/purchases/invoice-list-query";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

export async function generateMetadata() {
  const t = await getTranslations("purchases.invoices");
  return { title: `${t("title")} · Miel` };
}

// Radix no admite value="" en un <Select>; "all" no es uuid y se lee como "todos".
const ALL = "all";

/**
 * S28-05: todas las facturas de proveedores por período, proveedor o número, con enlace a su orden
 * de compra, totales del período (IVA descontable) y descarga CSV. Solo dueño/admin (son costos).
 */
export default async function SupplierInvoicesPage({ searchParams }: { searchParams: Promise<InvoiceListParams> }) {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") notFound();
  const t = await getTranslations("purchases.invoices");
  const params = await searchParams;
  const f = invoiceFilters(params, todayInBogota());

  const supabase = await createClient();
  const [rows, suppliersRes] = await Promise.all([
    loadInvoiceRows(supabase, f),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);
  const totals = invoicesTotals(rows.map((r) => r.row));

  // Enlaces firmados de corta duración para "Ver archivo" (bucket privado), en una sola llamada.
  const paths = rows.map((r) => r.filePath).filter((p): p is string => !!p);
  const signed = paths.length ? ((await supabase.storage.from("purchase-invoices").createSignedUrls(paths, 600)).data ?? []) : [];
  const fileUrl = new Map(signed.map((s) => [s.path, s.signedUrl]));

  const query = new URLSearchParams({
    desde: f.from,
    hasta: f.to,
    ...(f.supplierId ? { proveedor: f.supplierId } : {}),
    ...(f.q ? { q: f.q } : {}),
    ...(f.voided ? { anuladas: "1" } : {}),
  }).toString();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/compras" aria-label={t("back")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" />
            </Link>
            <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild variant="outline">
          <a href={`/compras/facturas/csv?${query}`} download>
            <Download className="mr-2 size-4" />
            {t("downloadCsv")}
          </a>
        </Button>
      </div>

      <form method="get" className="grid grid-cols-1 items-end gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="desde">{t("from")}</Label>
          <Input id="desde" name="desde" type="date" defaultValue={f.from} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hasta">{t("to")}</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={f.to} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="proveedor">{t("supplier")}</Label>
          <Select name="proveedor" defaultValue={f.supplierId ?? ALL}>
            <SelectTrigger id="proveedor" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allSuppliers")}</SelectItem>
              {(suppliersRes.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="q">{t("search")}</Label>
          <Input id="q" name="q" maxLength={60} defaultValue={f.q} placeholder="FE-123" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="anuladas" value="1" defaultChecked={f.voided} className="size-4 accent-primary" />
            {t("showVoided")}
          </label>
          <Button type="submit">{t("filter")}</Button>
        </div>
      </form>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("columns.date")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.number")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.supplier")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.order")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("columns.subtotal")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("columns.tax")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("columns.total")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.due")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ id, purchaseId, filePath, row }) => {
                const url = filePath ? fileUrl.get(filePath) : undefined;
                return (
                  <tr key={id} className={`border-b border-border last:border-0 ${row.voided ? "text-muted-foreground line-through" : ""}`}>
                    <td className="whitespace-nowrap px-3 py-2.5">{formatDate(row.issued_on)}</td>
                    <td className="px-3 py-2.5 font-medium">{row.number}</td>
                    <td className="px-3 py-2.5">{row.supplier}</td>
                    <td className="px-3 py-2.5">
                      <Link href={`/compras/ordenes/${purchaseId}/recibir`} className="underline tabular-nums">
                        {row.order}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">${formatMoney(row.subtotal)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">${formatMoney(row.tax)}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">${formatMoney(row.total)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.due_on ? formatDate(row.due_on) : "—"}</td>
                    <td className="px-3 py-2.5">
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline">
                          <FileText className="size-3.5" />
                          {t("viewFile")}
                        </a>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="px-3 py-2.5" colSpan={4}>
                  {t("periodTotal", { count: rows.filter((r) => !r.row.voided).length })}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">${formatMoney(totals.subtotal)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">${formatMoney(totals.tax)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">${formatMoney(totals.total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
      )}
    </div>
  );
}
