import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { PositionForm } from "./position-form";
import { PositionRow } from "./position-row";

export const metadata = { title: "Cargos · Miel" };

/** S21-02c: cargos de la empresa (se eligen en la ficha del trabajador). */
export default async function CargosPage() {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") notFound();

  const supabase = await createClient();
  const [{ data: positions }, { data: workers }] = await Promise.all([
    supabase.from("worker_positions").select("id, name").order("name"),
    supabase.from("workers").select("position_id").eq("active", true),
  ]);
  const countByPosition = new Map<string, number>();
  for (const w of workers ?? []) {
    if (w.position_id) countByPosition.set(w.position_id, (countByPosition.get(w.position_id) ?? 0) + 1);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cargos</h1>
        <p className="text-sm text-muted-foreground">Los cargos que usas en la ficha de cada trabajador.</p>
      </div>

      <PositionForm />

      {positions && positions.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {positions.map((p) => (
            <PositionRow key={p.id} id={p.id} name={p.name} workerCount={countByPosition.get(p.id) ?? 0} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aún no tienes cargos. Crea el primero, por ejemplo &quot;Cajero&quot;.
        </p>
      )}
    </div>
  );
}
