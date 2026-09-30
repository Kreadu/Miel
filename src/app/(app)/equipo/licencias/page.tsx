import { notFound } from "next/navigation";

import { deleteLeave } from "@/actions/payroll";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { LEAVE_TYPES } from "@/lib/rrhh/payroll-input";
import { daysInclusive } from "@/lib/rrhh/services/dateRanges";
import type { EmployeeLeaveType } from "@/lib/rrhh/types/payroll";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { LeaveForm } from "./leave-form";

export const metadata = { title: "Licencias · Miel" };

/** S21-05: licencias e incapacidades — la nómina las descuenta y liquida sola en su período. */
export default async function LicenciasPage() {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") notFound();

  const supabase = await createClient();
  const [{ data: leaves }, { data: workers }] = await Promise.all([
    supabase
      .from("worker_leaves")
      .select("id, type, start_date, end_date, note, workers(full_name)")
      .order("start_date", { ascending: false }),
    supabase.from("workers").select("id, full_name").eq("active", true).order("full_name"),
  ]);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Licencias e incapacidades</h1>
        <p className="text-sm text-muted-foreground">
          Al liquidar un período, la nómina toma sola los días de licencia que caen en él.
        </p>
      </div>

      <LeaveForm workers={workers ?? []} />

      {leaves && leaves.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Trabajador</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Desde</th>
                <th className="px-3 py-2 font-medium">Hasta</th>
                <th className="px-3 py-2 text-right font-medium">Días</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5">{l.workers?.full_name ?? "—"}</td>
                  <td className="px-3 py-2.5">{LEAVE_TYPES[l.type as EmployeeLeaveType] ?? l.type}</td>
                  <td className="px-3 py-2.5">{formatDate(l.start_date)}</td>
                  <td className="px-3 py-2.5">{formatDate(l.end_date)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{daysInclusive(l.start_date, l.end_date)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <form action={deleteLeave}>
                      <input type="hidden" name="id" value={l.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Borrar
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No hay licencias registradas.
        </p>
      )}
    </div>
  );
}
