import Link from "next/link";
import {
  Banknote,
  TrendingUp,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";

export async function DashboardMetricsCards() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dashboard_metrics")
    .select("*")
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const cards: { title: string; value: string; href?: string; icon: typeof Banknote }[] = [
    {
      title: "Ventas del mes",
      value: formatCurrency(metrics.current_month_sales || 0),
      icon: Banknote,
    },
    {
      title: "Utilidad del mes",
      value: formatCurrency(metrics.current_month_utility || 0),
      icon: TrendingUp,
    },
    {
      title: "Valor en inventario",
      value: formatCurrency(metrics.inventory_value || 0),
      href: "/inventario/kardex",
      icon: Package,
    },
    {
      title: "Cuentas por cobrar",
      value: formatCurrency(metrics.total_receivable || 0),
      href: "/ventas/cuentas-por-cobrar",
      icon: ArrowDownToLine,
    },
    {
      title: "Cuentas por pagar",
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
