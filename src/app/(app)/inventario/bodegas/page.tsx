import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { PrincipalForm } from "./principal-form";
import type { TransferProduct } from "./transfer-form";
import { WarehouseForm } from "./warehouse-form";
import { WarehouseRow } from "./warehouse-row";

export async function generateMetadata() {
  const t = await getTranslations("warehouses");
  return { title: `${t("title")} · Miel` };
}

export default async function BodegasPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const canManage = active.role !== "member";
  const t = await getTranslations("warehouses");

  const supabase = await createClient();
  const [{ data: warehouses }, { data: stockRows }] = await Promise.all([
    supabase
      .from("warehouses")
      .select(
        "id, name, active, is_default, lends_stock, address, department, city, country, postal_code, phone, whatsapp",
      )
      .eq("tenant_id", active.tenantId)
      .order("name", { ascending: true }),
    // S19-38/S19-39: stock por bodega y producto (dar de baja y trasladar).
    supabase
      .from("current_stock")
      .select("warehouse_id, product_id, total_qty")
      .eq("tenant_id", active.tenantId),
  ]);
  const productIds = [
    ...new Set(
      (stockRows ?? [])
        .map((r) => r.product_id)
        .filter((id): id is string => !!id),
    ),
  ];
  const { data: products } = productIds.length
    ? await supabase
        .from("products_catalog")
        .select("id, name, sku")
        .in("id", productIds)
    : { data: [] };
  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const unitsByWarehouse = new Map<string, number>();
  const productsByWarehouse = new Map<string, TransferProduct[]>();
  for (const r of stockRows ?? []) {
    const qty = Number(r.total_qty ?? 0);
    if (!r.warehouse_id || !r.product_id || qty <= 0) continue;
    unitsByWarehouse.set(
      r.warehouse_id,
      (unitsByWarehouse.get(r.warehouse_id) ?? 0) + qty,
    );
    const p = productById.get(r.product_id);
    const list = productsByWarehouse.get(r.warehouse_id) ?? [];
    list.push({
      id: r.product_id,
      name: p?.name ?? "—",
      sku: p?.sku ?? "",
      qty,
    });
    productsByWarehouse.set(r.warehouse_id, list);
  }
  const activeWarehouses = (warehouses ?? [])
    .filter((w) => w.active)
    .map((w) => ({ id: w.id, name: w.name }));
  const transferFor = (w: { id: string; name: string }) => ({
    fromId: w.id,
    fromName: w.name,
    destinations: activeWarehouses.filter((d) => d.id !== w.id),
    products: productsByWarehouse.get(w.id) ?? [],
  });

  // S19-25: la principal arriba con todos sus datos; el resto, en la lista de abajo.
  const principal = warehouses?.find((w) => w.is_default);
  const others = (warehouses ?? []).filter((w) => !w.is_default);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{active.tenantName}</p>
      </div>

      {principal ? (
        <PrincipalForm
          id={principal.id}
          details={principal}
          canManage={canManage}
          transfer={transferFor(principal)}
        />
      ) : null}

      {canManage ? <WarehouseForm /> : null}

      {others.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold tracking-tight">
            {t("others")}
          </h2>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {others.map((w) => (
              <WarehouseRow
                key={w.id}
                id={w.id}
                active={w.active}
                canManage={canManage}
                details={w}
                stockUnits={unitsByWarehouse.get(w.id) ?? 0}
                transfer={transferFor(w)}
              />
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {canManage ? t("emptyManage") : t("emptyPublic")}
        </p>
      )}
    </div>
  );
}
