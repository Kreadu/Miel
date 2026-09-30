import Link from "next/link";
import {
  Banknote,
  TrendingUp,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/** E20: filtro explícito de empresa — un dueño puede administrar varias (mismo caso que Resultados). */
export async function DashboardMetricsCards({ tenantId }: { tenantId: string }) {
  const supabase = await createClient();
  const t = await getTranslations("home.metrics");
  const { data, error } = await supabase
    .from("dashboard_metrics")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching dashboard metrics:", error);
    return null;
  }

  // Si no hay datos (tenant nuevo), los valores por defecto serán 0.
  const metrics = data || {
    current_month_sales: 0,
    current_month_utility: 0,
    inventory_value: 0,
    total_receivable: 0,
    total_payable: 0,
  };

  const formatCurrency = (amount: number) =>
    formatMoney(amount, { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const cards: { title: string; value: string; href?: string; icon: typeof Banknote }[] = [
    {
      title: t("sales"),
      value: formatCurrency(metrics.current_month_sales || 0),
      icon: Banknote,
    },
    {
      title: t("profit"),
      value: formatCurrency(metrics.current_month_utility || 0),
      icon: TrendingUp,
    },
    {
      title: t("inventory"),
      value: formatCurrency(metrics.inventory_value || 0),
      href: "/inventario/kardex",
      icon: Package,
    },
    {
      title: t("receivable"),
      value: formatCurrency(metrics.total_receivable || 0),
      href: "/ventas/cuentas-por-cobrar",
      icon: ArrowDownToLine,
    },
    {
      title: t("payable"),
      value: formatCurrency(metrics.total_payable || 0),
      href: "/compras/cuentas-por-pagar",
      icon: ArrowUpFromLine,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        const content = (
          <>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="size-4" aria-hidden="true" />
              <h3 className="text-xs font-medium">{card.title}</h3>
            </div>
            <p className="text-xl font-semibold tabular-nums text-foreground">
              {card.value}
            </p>
          </>
        );
        if (!card.href) {
          return (
            <div key={card.title} className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-xs">
              {content}
            </div>
          );
        }
        return (
          <Link
            key={card.title}
            href={card.href}
            className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:bg-muted"
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}
