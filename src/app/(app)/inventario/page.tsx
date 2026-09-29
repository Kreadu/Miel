import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Armchair,
  Boxes,
  Car,
  PackageOpen,
  Paperclip,
  SprayCan,
  Warehouse,
  Wrench,
} from "lucide-react";
import { INVENTORIES, type InventoryId, inventoryPath } from "@/lib/inventories";
import { createClient } from "@/lib/supabase/server";
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
  // S19-34: la tabla de stock se mudó al "Historial" de cada inventario.
  const [prodRes, alertsRes] = await Promise.all([
    supabase.from("products_catalog").select("inventory, active"),
    supabase.from("low_stock_alerts").select("product_id"),
  ]);

  // S19-26: cantidad de ítems activos por inventario, para los botones de cada uno.
  const countByInventory = new Map<string, number>();
  for (const p of prodRes.data ?? []) {
    if (p.active && p.inventory) {
      countByInventory.set(p.inventory, (countByInventory.get(p.inventory) ?? 0) + 1);
    }
  }
  const alertsList = alertsRes.data || [];
  const alertProductIds = new Set(alertsList.map(a => a.product_id));

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
    </div>
  );
}
