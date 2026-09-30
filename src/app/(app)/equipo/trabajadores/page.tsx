import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { WorkerForm } from "./worker-form";
import { WorkerRow } from "./worker-row";

export const metadata = { title: "Trabajadores · Miel" };

/** S21-02: trabajadores de la empresa (solo owner/admin: hay salario y datos personales). */
export default async function TrabajadoresPage() {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") notFound();

  const supabase = await createClient();
  const [{ data: workers }, { data: categories }, { data: warehouses }] = await Promise.all([
    supabase
      .from("workers")
      .select(
        "id, active, full_name, doc_type, doc_number, position, hire_date, contract_type, salary, work_schedule, eps, pension_fund, arl_risk_class, phone, email, address, warehouse_id, category_id",
      )
      .order("active", { ascending: false })
      .order("full_name"),
    supabase.from("worker_categories").select("id, name").order("name"),
    supabase.from("warehouses").select("id, name").eq("active", true).order("name"),
  ]);
  const cats = categories ?? [];
  const whs = warehouses ?? [];

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Trabajadores</h1>
        <p className="text-sm text-muted-foreground">{active.tenantName}</p>
      </div>

      <WorkerForm categories={cats} warehouses={whs} />

      {workers && workers.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {workers.map((w) => (
            <WorkerRow
              key={w.id}
              id={w.id}
              active={w.active}
              values={w}
              categories={cats}
              warehouses={whs}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aún no tienes trabajadores. Agrega el primero con el botón de arriba.
        </p>
      )}
    </div>
  );
}
