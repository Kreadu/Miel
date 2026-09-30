import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { PrincipalForm } from "./principal-form";
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
    // S19-38: unidades por bodega, para avisar al darla de baja.
    supabase.from("current_stock").select("warehouse_id, total_qty").eq("tenant_id", active.tenantId),
  ]);
  const unitsByWarehouse = new Map<string, number>();
  for (const r of stockRows ?? []) {
    if (r.warehouse_id) unitsByWarehouse.set(r.warehouse_id, (unitsByWarehouse.get(r.warehouse_id) ?? 0) + Number(r.total_qty ?? 0));
  }

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
        <PrincipalForm id={principal.id} details={principal} canManage={canManage} />
      ) : null}

      {canManage ? <WarehouseForm /> : null}

      {others.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold tracking-tight">{t("others")}</h2>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {others.map((w) => (
              <WarehouseRow
                key={w.id}
                id={w.id}
                active={w.active}
                canManage={canManage}
                details={w}
                stockUnits={unitsByWarehouse.get(w.id) ?? 0}
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
