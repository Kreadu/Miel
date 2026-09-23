import { notFound } from "next/navigation";

import { createCustomer } from "@/actions/customers";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { CustomerForm } from "./customer-form";
import { CustomerRow } from "./customer-row";

export const metadata = { title: "Clientes · Miel" };

export default async function ClientesPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const canManage = active.role !== "member";

  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, doc_type, doc_number, email, phone, address, note, active")
    .order("name", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Clientes</h1>
        <p className="text-sm text-muted-foreground">{active.tenantName}</p>
      </div>

      {canManage ? (
        <CustomerForm
          action={createCustomer}
          submitLabel="Crear cliente"
          pendingLabel="Creando…"
        />
      ) : null}

      {customers && customers.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Documento</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Teléfono</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <CustomerRow
                  key={c.id}
                  canManage={canManage}
                  customer={{
                    id: c.id,
                    name: c.name,
                    doc_type: c.doc_type || "nit",
                    doc_number: c.doc_number,
                    email: c.email,
                    phone: c.phone,
                    address: c.address,
                    note: c.note,
                    active: c.active,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {canManage
            ? "Aún no tienes clientes. Crea el primero arriba."
            : "Aún no hay clientes registrados."}
        </p>
      )}
    </div>
  );
}
