import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { revokeInvitation } from "@/actions/invitations";

import { InviteForm } from "./invite-form";

export const metadata = { title: "Usuarios con correo · Miel" };

const ROLE_LABEL: Record<string, string> = { owner: "Dueño", admin: "Administrador", member: "Cuenta de la tienda" };

/** S21-03: el acceso se muestra como rol o, si tiene, su categoría. */
function accessLabel(role: string, categoryName: string | null | undefined): string {
  return role === "member" && categoryName ? `Categoría: ${categoryName}` : (ROLE_LABEL[role] ?? role);
}

export default async function UsuariosPage() {
  const { active } = await getActiveTenant();
  // UX (nextjs-miel): recurso que el rol no debería ver → notFound(), nunca un 403. La
  // frontera real es RLS sobre `invitations`, esto solo evita exponer la ruta a `member`.
  if (!active || active.role === "member") notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Un solo select por lista, sin N+1. Miembros solo por rol (sin email de terceros — ver
  // specs/S1-05-invitaciones-roles.md, Alcance).
  const [{ data: members }, { data: pending }, { data: categories }] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, role, worker_categories(name)")
      .order("created_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("id, email, role, expires_at, worker_categories(name)")
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("worker_categories").select("id, name").order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Usuarios con correo</h1>
        <p className="text-sm text-muted-foreground">
          Quienes entran con correo y contraseña. Los trabajadores con usuario y código de 4 dígitos se
          manejan desde su ficha.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Equipo de la tienda:</strong> invita un correo de
          la tienda con acceso &quot;Cuenta de la tienda&quot;. Al entrar con esa cuenta en el
          computador de la tienda, aprieta &quot;Activar modo tienda&quot;: desde ahí cada trabajador
          entra con su usuario y código.
        </p>
      </div>

      <InviteForm categories={categories ?? []} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Miembros</h2>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{m.user_id === user?.id ? "Tú" : "Miembro"}</span>
              <span className="text-muted-foreground">{accessLabel(m.role, m.worker_categories?.name)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Invitaciones pendientes</h2>
        {pending && pending.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {pending.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="flex flex-col">
                  <span>{inv.email}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {accessLabel(inv.role, inv.worker_categories?.name)}
                  </span>
                </div>
                <form action={revokeInvitation}>
                  <input type="hidden" name="id" value={inv.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Revocar
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Aún no has invitado a nadie.
          </p>
        )}
      </section>
    </div>
  );
}
