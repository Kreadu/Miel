import { notFound } from "next/navigation";

import { createSupplier } from "@/actions/suppliers";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { SupplierForm } from "./supplier-form";
import { SupplierRow } from "./supplier-row";

export const metadata = { title: "Proveedores · Miel" };

export default async function ProveedoresPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const canManage = active.role !== "member";

  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, nit, email, phone, address, active")
    .order("name", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Proveedores</h1>
        <p className="text-sm text-muted-foreground">{active.tenantName}</p>
      </div>

      {canManage ? (
        <SupplierForm
          action={createSupplier}
          submitLabel="Crear proveedor"
          pendingLabel="Creando…"
        />
      ) : null}

      {suppliers && suppliers.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">NIT</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Teléfono</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <SupplierRow
                  key={s.id}
                  canManage={canManage}
                  supplier={{
                    id: s.id,
                    name: s.name,
                    nit: s.nit,
                    email: s.email,
                    phone: s.phone,
                    address: s.address,
                    active: s.active,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {canManage
            ? "Aún no tienes proveedores. Crea el primero arriba."
            : "Aún no hay proveedores registrados."}
        </p>
      )}
    </div>
  );
}
