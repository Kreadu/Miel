import Link from "next/link";
import { AlertTriangle, TrendingUp, TrendingDown, Package, CheckCircle2 } from "lucide-react";

import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";

/** E20: filtro explícito de empresa — un dueño puede administrar varias. */
export async function DashboardInsights({ tenantId }: { tenantId: string }) {
  const supabase = await createClient();
  const t = await getTranslations("home.insights");

  // Consultamos en paralelo las vistas gerenciales
  const [topSoldRes, leastSoldRes, topMarginRes, lowStockRes] = await Promise.all([
    supabase
      .from("product_profitability")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("sold_qty", { ascending: false })
      .limit(10),
    supabase
      .from("product_profitability")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("sold_qty", { ascending: true })
      .limit(10),
    supabase
      .from("product_profitability")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("margin_percent", { ascending: false })
      .limit(10),
    supabase
      .from("low_stock_alerts")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("total_qty", { ascending: true }),
  ]);

  const topSold = topSoldRes.data || [];
  const leastSold = leastSoldRes.data || [];
  const topMargin = topMarginRes.data || [];
  const lowStock = lowStockRes.data || [];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {/* Top Vendidos */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Package className="size-4" aria-hidden="true" />
          <h3 className="text-sm font-medium text-foreground">{t("topSold")}</h3>
        </div>
        {topSold.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("noSales")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {topSold.map((product) => (
              <li key={product.product_id} className="flex items-center justify-between text-sm">
                <span className="truncate pr-2" title={product.name ?? undefined}>
                  {product.name}
                </span>
                <span className="shrink-0 font-medium tabular-nums">{t("units", { qty: product.sold_qty ?? 0 })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Menos Vendidos */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <TrendingDown className="size-4" aria-hidden="true" />
          <h3 className="text-sm font-medium text-foreground">{t("leastSold")}</h3>
        </div>
        {leastSold.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("noSales")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {leastSold.map((product) => (
              <li key={product.product_id} className="flex items-center justify-between text-sm">
                <span className="truncate pr-2" title={product.name ?? undefined}>
                  {product.name}
                </span>
                <span className="shrink-0 font-medium tabular-nums">{t("units", { qty: product.sold_qty ?? 0 })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Top Rentables */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <TrendingUp className="size-4" aria-hidden="true" />
          <h3 className="text-sm font-medium text-foreground">{t("topMargin")}</h3>
        </div>
        {topMargin.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("noMargin")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {topMargin.map((product) => (
              <li key={product.product_id} className="flex items-center justify-between text-sm">
                <span className="truncate pr-2" title={product.name ?? undefined}>
                  {product.name}
                </span>
                <span className="shrink-0 font-medium tabular-nums">{product.margin_percent}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Alertas de Stock */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <h3 className="text-sm font-medium text-foreground">{t("lowStock")}</h3>
          </div>
          {lowStock.length > 0 && (
            <Link href="/inventario/alertas" className="text-xs text-primary hover:underline">
              {t("seeAll")}
            </Link>
          )}
        </div>
        {lowStock.length === 0 ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4" />
            <span>{t("allGood")}</span>
          </div>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {lowStock.slice(0, 10).map((product) => (
              <li key={product.product_id} className="flex items-center justify-between text-sm">
                <Link
                  href={`/inventario/kardex/${product.product_id}`}
                  className="truncate pr-2 hover:underline"
                  title={product.name ?? undefined}
                >
                  {product.name}
                </Link>
                <div className="flex shrink-0 items-center gap-1 tabular-nums">
                  <span className="font-medium text-destructive">{product.total_qty}</span>
                  <span className="text-xs text-muted-foreground">/ {product.min_stock}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
