import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { INVENTORIES, inventoryBySlug } from "@/lib/inventories";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { type AlertItem, AlertsList } from "./alerts-list";

export async function generateMetadata() {
  const t = await getTranslations("inventory");
  return { title: `${t("alerts")} · Miel` };
}

export default async function AlertasStockPage({
  searchParams,
}: {
  searchParams: Promise<{ inventario?: string }>;
}) {
  const { active } = await getActiveTenant();
  if (!active) notFound();
  const t = await getTranslations("inventory");
  // S19-29: un botón por inventario; dentro, solo sus ítems bajo el mínimo.
  const { inventario } = await searchParams;
  const selected = inventario ? inventoryBySlug(inventario) : undefined;

  const supabase = await createClient();
  const { data: alerts, error } = await supabase
    .from("low_stock_alerts")
    .select("product_id, sku, name, min_stock, total_qty")
    .order("name");

  if (error) {
    console.error("Error fetching low stock alerts", error);
  }

  // S19-27/S19-29: foto, unidad e inventario de cada ítem en alerta (una sola consulta batch).
  const ids = (alerts ?? []).map((a) => a.product_id).filter((id): id is string => id != null);
  const { data: details } = ids.length
    ? await supabase.from("products_catalog").select("id, unit, photo_url, inventory").in("id", ids)
    : { data: [] };
  const detailById = new Map((details ?? []).map((d) => [d.id, d]));

  const allAlerts: (AlertItem & { inventory: string })[] = (alerts ?? [])
    .filter((a): a is typeof a & { product_id: string } => a.product_id != null)
    .map((a) => {
      const d = detailById.get(a.product_id);
      return {
        productId: a.product_id,
        inventory: d?.inventory ?? "productos",
        sku: a.sku ?? "",
        name: a.name ?? "",
        unit: d?.unit ?? "",
        photoUrl: d?.photo_url ?? null,
        minStock: Number(a.min_stock ?? 0),
        totalQty: Number(a.total_qty ?? 0),
      };
    });

  const countByInventory = new Map<string, number>();
  for (const a of allAlerts) countByInventory.set(a.inventory, (countByInventory.get(a.inventory) ?? 0) + 1);
  const alertList = selected ? allAlerts.filter((a) => a.inventory === selected.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {t("alerts")}
          </h1>
          <p className="text-sm text-muted-foreground">{active.tenantName}</p>
        </div>
        <div>
          <Link
            href="/inventario"
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("alertsPage.back")}
          </Link>
        </div>
      </div>

      <nav className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {INVENTORIES.map((inv) => {
          const count = countByInventory.get(inv.id) ?? 0;
          const isSelected = selected?.id === inv.id;
          return (
            <Link
              key={inv.id}
              href={`/inventario/alertas?inventario=${inv.slug}`}
              className={`flex items-center justify-between gap-2 rounded-lg border p-3 text-sm shadow-xs transition-colors ${
                isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted/50"
              }`}
            >
              <span className="font-medium">{t(`types.${inv.id}.title`)}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                  count > 0 ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {!selected ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          {allAlerts.length > 0 ? t("alertsPage.chooseInventory") : t("alertsPage.allGood")}
        </p>
      ) : alertList.length > 0 ? (
        <AlertsList key={selected.id} items={alertList} canManage={active.role !== "member"} />
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          {t("alertsPage.noneIn", { inventory: t(`types.${selected.id}.title`) })}
        </p>
      )}
    </div>
  );
}
