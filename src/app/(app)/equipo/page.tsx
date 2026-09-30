import { BriefcaseBusiness, Clock, HandCoins, HeartPulse, Tags, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { revokeInvitation } from "@/actions/invitations";

import { InviteForm } from "./invite-form";

export const metadata = { title: "RRHH · Miel" };

const LINK_CLASS =
  "inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80";

const ROLE_LABEL: Record<string, string> = { owner: "Dueño", admin: "Admin", member: "Operativo" };

export default async function EquipoPage() {
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
  const [{ data: members }, { data: pending }] = await Promise.all([
    supabase.from("memberships").select("user_id, role").order("created_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("id, email, role, expires_at")
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">RRHH</h1>
          <p className="text-sm text-muted-foreground">{active.tenantName}</p>
        </div>
        {/* S21-02: trabajadores y sus categorías (qué ve cada uno). */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/equipo/trabajadores" className={LINK_CLASS}>
            <UserRound className="mr-2 h-4 w-4" />
            Trabajadores
          </Link>
          <Link
            href="/equipo/nomina"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <HandCoins className="mr-2 h-4 w-4" />
            Nómina
          </Link>
          <Link href="/equipo/licencias" className={LINK_CLASS}>
            <HeartPulse className="mr-2 h-4 w-4" />
            Licencias
          </Link>
          <Link href="/equipo/temporales" className={LINK_CLASS}>
            <Clock className="mr-2 h-4 w-4" />
            Temporales y por horas
          </Link>
          <Link href="/equipo/cargos" className={LINK_CLASS}>
            <BriefcaseBusiness className="mr-2 h-4 w-4" />
            Cargos
          </Link>
          <Link href="/equipo/categorias" className={LINK_CLASS}>
            <Tags className="mr-2 h-4 w-4" />
            Categorías de trabajador
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold tracking-tight">Usuarios con correo</h2>
        <p className="text-sm text-muted-foreground">
          Dueño y administradores entran con correo y contraseña. Los trabajadores entrarán con su
          usuario y código de 4 dígitos.
        </p>
      </section>

      <InviteForm />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Miembros</h2>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{m.user_id === user?.id ? "Tú" : "Miembro"}</span>
              <span className="text-muted-foreground">{ROLE_LABEL[m.role]}</span>
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
                    {ROLE_LABEL[inv.role]}
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
