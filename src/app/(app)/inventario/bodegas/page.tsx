import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { WarehouseForm } from "./warehouse-form";
import { WarehouseRow } from "./warehouse-row";

export const metadata = { title: "Bodegas · Miel" };

export default async function BodegasPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const canManage = active.role !== "member";

  const supabase = await createClient();
  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("id, name, active")
    .order("name", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Bodegas</h1>
        <p className="text-sm text-muted-foreground">{active.tenantName}</p>
      </div>

      {canManage ? <WarehouseForm /> : null}

      {warehouses && warehouses.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {warehouses.map((w) => (
            <WarehouseRow
              key={w.id}
              id={w.id}
              name={w.name}
              active={w.active}
              canManage={canManage}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {canManage
            ? "Aún no tienes bodegas. Crea la primera arriba."
            : "Aún no hay bodegas registradas."}
        </p>
      )}
    </div>
  );
}
