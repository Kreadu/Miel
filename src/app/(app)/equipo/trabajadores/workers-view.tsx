import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import type { WorkerArea } from "./worker-fields";
import { WorkerForm } from "./worker-form";
import { WorkerRow } from "./worker-row";

const AREA_TYPES: Record<WorkerArea, string[]> = {
  planta: ["planta"],
  temporales: ["temporal", "por_horas"],
};

/**
 * S21-02/S21-02c: lista y alta de trabajadores de un área de RRHH — de planta o temporales y por
 * horas. Solo owner/admin (hay salario y datos personales; RLS lo exige igual).
 */
export async function WorkersView({ area, title }: { area: WorkerArea; title: string }) {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") notFound();

  const supabase = await createClient();
  const [{ data: workers }, { data: categories }, { data: positions }, { data: warehouses }] =
    await Promise.all([
      supabase
        .from("workers")
        .select(
          "id, active, full_name, doc_type, doc_number, position_id, hire_date, worker_type, end_date, hourly_rate, contract_type, salary, work_schedule, eps, pension_fund, arl_risk_class, phone, email, address, emergency_contact_name, emergency_phone, warehouse_id, category_id, username, user_id, cost_classification",
        )
        .in("worker_type", AREA_TYPES[area])
        .order("active", { ascending: false })
        .order("full_name"),
      supabase.from("worker_categories").select("id, name").order("name"),
      supabase.from("worker_positions").select("id, name").order("name"),
      supabase.from("warehouses").select("id, name").eq("active", true).order("name"),
    ]);
  const cats = categories ?? [];
  const pos = positions ?? [];
  const whs = warehouses ?? [];

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{active.tenantName}</p>
      </div>

      <WorkerForm area={area} categories={cats} positions={pos} warehouses={whs} />

      {workers && workers.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {workers.map((w) => (
            <WorkerRow
              key={w.id}
              id={w.id}
              area={area}
              active={w.active}
              values={w}
              categories={cats}
              positions={pos}
              warehouses={whs}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aún no hay trabajadores aquí. Agrega el primero con el botón de arriba.
        </p>
      )}
    </div>
  );
}
