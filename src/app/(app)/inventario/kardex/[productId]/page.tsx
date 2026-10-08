import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney as baseFormatMoney } from "@/lib/format";
import { getActiveTenant } from "@/lib/tenant/server";
import { SupplierPriceHistory } from "@/components/purchases/supplier-price-history";

import { StockMovementForm } from "../../stock-movement-form";

export async function generateMetadata() {
  const t = await getTranslations("inventory.kardex");
  return { title: `${t("title")} · Miel` };
}

interface KardexPageProps {
  params: { productId: string };
  searchParams: { warehouse_id?: string };
}

export default async function KardexPage({ params, searchParams }: KardexPageProps) {
  const { active } = await getActiveTenant();
  if (!active) notFound();
  const t = await getTranslations("inventory.kardex");

  const productId = params.productId;
  const warehouseId = searchParams.warehouse_id;

  if (!warehouseId) {
    notFound();
  }

  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products_catalog")
    .select("name, sku, unit")
    .eq("id", productId)
    .single();

  if (!product) notFound();

  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("name")
    .eq("id", warehouseId)
    .single();

  const { data: kardex, error } = await supabase
    .from("kardex")
    .select("*")
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)
    .order("date", { ascending: true })
    .order("movement_id", { ascending: true });

  if (error) {
    console.error("Error fetching kardex", error);
  }

  const isMember = active.role === "member";

  const getKindLabel = (kind: string) => (t.has(`kind.${kind}`) ? t(`kind.${kind}`) : kind);

  const getKindColor = (kind: string) => {
    if (kind.includes("in") && kind !== "production_out") return "text-emerald-600 font-medium";
    if (kind.includes("out")) return "text-rose-600 font-medium";
    return "text-amber-600 font-medium";
  };

  const formatDate = (dateString: string) => formatDateTime(dateString);

  const formatMoney = (val: number | string | null | undefined) => {
    if (val === null || val === undefined) return "—";
    return `$${baseFormatMoney(val)}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/inventario" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {product.name} ({product.sku}) · {warehouse?.name ?? t("unknownWarehouse")}
          </p>
        </div>
        {!isMember && (
          <StockMovementForm productId={productId} warehouseId={warehouseId} />
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th colSpan={3} className="px-3 py-2 text-center border-r border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("movement")}
              </th>
              <th colSpan={!isMember ? 3 : 1} className="px-3 py-2 text-center border-r border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("transaction")}
              </th>
              <th colSpan={!isMember ? 3 : 1} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("balance")}
              </th>
            </tr>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("date")}</th>
              <th className="px-3 py-2 font-medium">{t("type")}</th>
              <th className="px-3 py-2 font-medium border-r border-border">{t("ref")}</th>
              
              <th className="px-3 py-2 text-right font-medium">{t("qty")}</th>
              {!isMember && <th className="px-3 py-2 text-right font-medium">{t("unitCost")}</th>}
              {!isMember && <th className="px-3 py-2 text-right font-medium border-r border-border">{t("total")}</th>}
              
              <th className="px-3 py-2 text-right font-medium">{t("qty")}</th>
              {!isMember && <th className="px-3 py-2 text-right font-medium">{t("avgCost")}</th>}
              {!isMember && <th className="px-3 py-2 text-right font-medium">{t("totalValue")}</th>}
            </tr>
          </thead>
          <tbody>
            {kardex && kardex.length > 0 ? (
              kardex.map((row) => (
                <tr key={row.movement_id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="px-3 py-3 text-sm tabular-nums text-muted-foreground whitespace-nowrap">
                    {formatDate(row.date || '')}
                  </td>
                  <td className={`px-3 py-3 text-sm ${getKindColor(row.kind || '')}`}>
                    {getKindLabel(row.kind || '')}
                  </td>
                  <td className="px-3 py-3 text-sm text-muted-foreground border-r border-border">
                    {row.ref_type && t.has(`refTypes.${row.ref_type}`) ? t(`refTypes.${row.ref_type}`) : row.ref_type}
                    {/* Los ids internos (uuid de venta o traslado) no le dicen nada a nadie. */}
                    {row.ref_id && row.ref_id.length < 36 ? ` #${row.ref_id}` : ""}
                  </td>
                  
                  <td className={`px-3 py-3 text-sm text-right font-medium ${(row.qty || 0) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {(row.qty || 0) > 0 ? '+' : ''}{Number(row.qty || 0).toLocaleString()}
                  </td>
                  {!isMember && <td className="px-3 py-3 text-sm text-right text-muted-foreground">{formatMoney(row.unit_cost)}</td>}
                  {!isMember && (
                    <td className="px-3 py-3 text-sm text-right border-r border-border font-medium">
                      {formatMoney(Number(row.qty) * Number(row.unit_cost || 0))}
                    </td>
                  )}
                  
                  <td className="px-3 py-3 text-sm text-right font-bold tabular-nums">
                    {Number(row.accumulated_qty).toLocaleString()} <span className="text-muted-foreground text-xs font-normal">{product.unit}</span>
                  </td>
                  {!isMember && <td className="px-3 py-3 text-sm text-right text-muted-foreground">{formatMoney(row.average_cost)}</td>}
                  {!isMember && <td className="px-3 py-3 text-sm text-right font-semibold tabular-nums">{formatMoney(row.accumulated_value)}</td>}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isMember ? 5 : 9} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!isMember ? <SupplierPriceHistory productId={productId} /> : null}
    </div>
  );
}
