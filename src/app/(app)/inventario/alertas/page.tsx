import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

export const metadata = { title: "Alertas de Stock · Miel" };

export default async function AlertasStockPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const supabase = await createClient();
  const { data: alerts, error } = await supabase
    .from("low_stock_alerts")
    .select("product_id, sku, name, min_stock, total_qty")
    .order("name");

  if (error) {
    console.error("Error fetching low stock alerts", error);
  }

  const alertList = alerts || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alertas de Stock
          </h1>
          <p className="text-sm text-muted-foreground">{active.tenantName}</p>
        </div>
        <div>
          <Link
            href="/inventario"
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Inventario
          </Link>
        </div>
      </div>

      {alertList.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground bg-destructive/5">
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 text-right font-medium">Stock Mínimo</th>
                <th className="px-3 py-2 text-right font-medium">Stock Actual</th>
              </tr>
            </thead>
            <tbody>
              {alertList.map((item, idx) => (
                <tr key={`${item.product_id}-${idx}`} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="px-3 py-3 text-sm">{item.sku}</td>
                  <td className="px-3 py-3 text-sm font-medium text-destructive">{item.name}</td>
                  <td className="px-3 py-3 text-sm text-right text-muted-foreground">
                    {Number(item.min_stock).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-sm text-right font-semibold text-destructive">
                    {Number(item.total_qty).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-8 text-center bg-muted/20">
          <p className="text-sm text-muted-foreground">
            No hay productos bajo su nivel mínimo de stock. Todo está en orden.
          </p>
        </div>
      )}
    </div>
  );
}
