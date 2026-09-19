import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageOpen, Warehouse, History, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { getActiveTenant } from "@/lib/tenant/server";
import { StockMovementForm } from "./stock-movement-form";

export const metadata = { title: "Inventario · Miel" };

export default async function InventarioPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const supabase = await createClient();
  const [stockRes, prodRes, whRes, alertsRes] = await Promise.all([
    supabase.from("current_stock").select("product_id, warehouse_id, total_qty, total_value").order("product_id"),
    supabase.from("products_catalog").select("id, name, sku, unit"),
    supabase.from("warehouses").select("id, name"),
    supabase.from("low_stock_alerts").select("product_id")
  ]);

  const stockList = stockRes.data || [];
  const products = (prodRes.data || [])
    .filter((p): p is typeof p & { id: string } => p.id !== null)
    .map((p) => ({ id: p.id, name: p.name ?? "—", sku: p.sku ?? "—", unit: p.unit ?? "" }));
  const warehouses = whRes.data || [];
  const alertsList = alertsRes.data || [];
  const alertProductIds = new Set(alertsList.map(a => a.product_id));

  if (stockRes.error) {
    console.error("Error fetching current stock", stockRes.error);
  }

  const isMember = active.role === "member";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Inventario</h1>
          <p className="text-sm text-muted-foreground">Aquí agregas tus productos y servicios.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {alertProductIds.size > 0 ? (
            <Link
              href="/inventario/alertas"
              className="inline-flex h-9 items-center justify-center rounded-md bg-destructive/10 px-4 text-sm font-medium text-destructive shadow-sm hover:bg-destructive/20"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Alertas ({alertProductIds.size})
            </Link>
          ) : (
            <Link
              href="/inventario/alertas"
              className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Alertas
            </Link>
          )}
          <Link
            href="/inventario/bodegas"
            className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            <Warehouse className="mr-2 h-4 w-4" />
            Bodegas
          </Link>
          <Link
            href="/inventario/productos"
            className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            <PackageOpen className="mr-2 h-4 w-4" />
            Productos
          </Link>
          {!isMember && (
            <Link
              href="/inventario/productos"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              + Nuevo producto
            </Link>
          )}
        </div>
      </div>

      {!isMember && (
        <StockMovementForm products={products} warehouses={warehouses} />
      )}

      {stockList && stockList.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Bodega</th>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 text-right font-medium">Stock</th>
                {!isMember && <th className="px-3 py-2 text-right font-medium">Valor Total</th>}
                <th className="px-3 py-2 text-center font-medium">Kardex</th>
              </tr>
            </thead>
            <tbody>
              {stockList.map((item, idx) => {
                const product = products.find(p => p.id === item.product_id);
                const warehouse = warehouses.find(w => w.id === item.warehouse_id);
                
                const productName = product?.name ?? "—";
                const productSku = product?.sku ?? "—";
                const productUnit = product?.unit ?? "";
                const warehouseName = warehouse?.name ?? "—";

                return (
                  <tr key={`${item.product_id}-${item.warehouse_id}-${idx}`} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="px-3 py-3 text-sm">{warehouseName}</td>
                    <td className="px-3 py-3 text-sm">{productSku}</td>
                    <td className="px-3 py-3 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {productName}
                        {alertProductIds.has(item.product_id) && (
                          <span title="Stock bajo el nivel mínimo" className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-right">
                      {Number(item.total_qty).toLocaleString()} <span className="text-muted-foreground text-xs">{productUnit}</span>
                    </td>
                    {!isMember && (
                      <td className="px-3 py-3 text-sm text-right">
                        {item.total_value !== null ? `$${formatMoney(item.total_value)}` : "—"}
                      </td>
                    )}
                    <td className="px-3 py-3 text-center">
                      <Link
                        href={`/inventario/kardex/${item.product_id}?warehouse_id=${item.warehouse_id}`}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        <History className="mr-1.5 h-3.5 w-3.5" />
                        Historial
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Aún no hay stock registrado en el sistema. Los movimientos de inventario actualizarán esta vista.
          </p>
        </div>
      )}
    </div>
  );
}
