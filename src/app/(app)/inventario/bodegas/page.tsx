import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { PrincipalForm } from "./principal-form";
import { WarehouseForm } from "./warehouse-form";
import { WarehouseRow } from "./warehouse-row";

export const metadata = { title: "Bodegas o sucursales · Miel" };

export default async function BodegasPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const canManage = active.role !== "member";

  const supabase = await createClient();
  const { data: warehouses } = await supabase
    .from("warehouses")
    .select(
      "id, name, active, is_default, address, department, city, country, postal_code, phone, whatsapp",
    )
    .order("name", { ascending: true });

  // S19-25: la principal arriba con todos sus datos; el resto, en la lista de abajo.
  const principal = warehouses?.find((w) => w.is_default);
  const others = (warehouses ?? []).filter((w) => !w.is_default);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Bodegas o sucursales</h1>
        <p className="text-sm text-muted-foreground">{active.tenantName}</p>
      </div>

      {principal ? (
        <PrincipalForm id={principal.id} details={principal} canManage={canManage} />
      ) : null}

      {canManage ? <WarehouseForm /> : null}

      {others.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold tracking-tight">Otras bodegas o sucursales</h2>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {others.map((w) => (
              <WarehouseRow
                key={w.id}
                id={w.id}
                active={w.active}
                canManage={canManage}
                details={w}
              />
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {canManage
            ? "Aún no tienes otras bodegas o sucursales. Crea una con el botón de arriba."
            : "No hay otras bodegas o sucursales registradas."}
        </p>
      )}
    </div>
  );
}
