import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Armchair,
  Boxes,
  Car,
  History,
  PackageOpen,
  Paperclip,
  SprayCan,
  Warehouse,
  Wrench,
} from "lucide-react";
import { INVENTORIES, type InventoryId, inventoryPath } from "@/lib/inventories";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { getActiveTenant } from "@/lib/tenant/server";

export const metadata = { title: "Inventario · Miel" };

const INVENTORY_ICON: Record<InventoryId, typeof PackageOpen> = {
  productos: PackageOpen,
  materias_primas: Boxes,
  articulos_oficina: Paperclip,
  mobiliario: Armchair,
  vehiculos: Car,
  herramientas: Wrench,
  aseo: SprayCan,
};

export default async function InventarioPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const supabase = await createClient();
  const [stockRes, prodRes, whRes, alertsRes] = await Promise.all([
    supabase.from("current_stock").select("product_id, warehouse_id, total_qty, total_value").order("product_id"),
    supabase.from("products_catalog").select("id, name, sku, unit, inventory, active"),
    supabase.from("warehouses").select("id, name"),
    supabase.from("low_stock_alerts").select("product_id")
  ]);

  const stockList = stockRes.data || [];
  const products = (prodRes.data || [])
    .filter((p): p is typeof p & { id: string } => p.id !== null)
    .map((p) => ({ id: p.id, name: p.name ?? "—", sku: p.sku ?? "—", unit: p.unit ?? "" }));
  const warehouses = whRes.data || [];
  // S19-26: cantidad de ítems activos por inventario, para los botones de cada uno.
  const countByInventory = new Map<string, number>();
  for (const p of prodRes.data ?? []) {
    if (p.active && p.inventory) {
      countByInventory.set(p.inventory, (countByInventory.get(p.inventory) ?? 0) + 1);
    }
  }
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
          <p className="text-sm text-muted-foreground">
            Entra a cada inventario para crear, editar o eliminar lo que tienes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {alertProductIds.size > 0 ? (
            <Link
              href="/inventario/alertas"
              className="inline-flex h-9 items-center justify-center rounded-md bg-destructive/10 px-4 text-sm font-medium text-destructive shadow-sm hover:bg-destructive/20"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Alertas stock mínimo ({alertProductIds.size})
            </Link>
          ) : (
            <Link
              href="/inventario/alertas"
              className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Alertas stock mínimo
            </Link>
          )}
          <Link
            href="/inventario/bodegas"
            className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            <Warehouse className="mr-2 h-4 w-4" />
            Bodegas o sucursales
          </Link>
        </div>
      </div>

      {/* S19-26: un botón por inventario, empezando por el de productos para vender. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {INVENTORIES.map((inv, i) => {
          const Icon = INVENTORY_ICON[inv.id];
          return (
            <Link
              key={inv.id}
              href={inventoryPath(inv)}
              className={`flex items-center gap-3 rounded-lg border p-4 shadow-xs transition-colors ${
                i === 0
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-border bg-card hover:bg-muted/50"
              }`}
            >
              <Icon className="size-5 shrink-0" />
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{inv.title}</span>
                <span className={`text-xs ${i === 0 ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {countByInventory.get(inv.id) ?? 0} ítems
                </span>
              </div>
            </Link>
          );
        })}
      </section>


      {stockList && stockList.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Bodega o sucursal</th>
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
