import { getTranslations } from "next-intl/server";

import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/**
 * S28-02: precios de proveedores (costo sin IVA de cada factura recibida y su variación contra la
 * compra anterior al mismo proveedor). Solo dueño/admin: la vista hereda su RLS (es costo).
 */
export async function SupplierPriceHistory({ productId, supplierId }: { productId?: string; supplierId?: string }) {
  const t = await getTranslations("purchases.priceHistory");
  const supabase = await createClient();
  let query = supabase
    .from("supplier_price_history")
    .select("line_id, supplier_name, invoice_number, issued_on, unit_cost, change_percent, product_name")
    .order("issued_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (productId) query = query.eq("product_id", productId);
  if (supplierId) query = query.eq("supplier_id", supplierId);
  const { data } = await query;
  const rows = data ?? [];

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold tracking-tight">{t("title")}</h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("date")}</th>
                <th className="px-3 py-2 font-medium">{supplierId ? t("product") : t("supplier")}</th>
                <th className="px-3 py-2 font-medium">{t("invoice")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("cost")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("change")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.line_id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(r.issued_on ?? "")}</td>
                  <td className="px-3 py-2">{supplierId ? r.product_name : r.supplier_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.invoice_number}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${formatMoney(r.unit_cost ?? 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {r.change_percent == null ? "—" : `${r.change_percent > 0 ? "+" : ""}${r.change_percent}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
