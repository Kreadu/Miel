import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { revokeInvitation } from "@/actions/invitations";

import { InviteForm } from "./invite-form";

export async function generateMetadata() {
  const t = await getTranslations("rrhh.users");
  return { title: `${t("title")} · Miel` };
}

export default async function UsuariosPage() {
  const { active } = await getActiveTenant();
  // UX (nextjs-miel): recurso que el rol no debería ver → notFound(), nunca un 403. La
  // frontera real es RLS sobre `invitations`, esto solo evita exponer la ruta a `member`.
  if (!active || active.role === "member") notFound();

  const supabase = await createClient();
  const t = await getTranslations("rrhh.users");
  // S21-03: el acceso se muestra como rol o, si tiene, su categoría.
  const accessLabel = (role: string, categoryName: string | null | undefined) =>
    role === "member" && categoryName
      ? t("categoryAccess", { name: categoryName })
      : t.has(`roles.${role}`)
        ? t(`roles.${role}`)
        : role;
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
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">{t("storeTitle")}</strong> {t("storeHelp")}
        </p>
      </div>

      <InviteForm categories={categories ?? []} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">{t("members")}</h2>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{m.user_id === user?.id ? t("you") : t("member")}</span>
              <span className="text-muted-foreground">{accessLabel(m.role, m.worker_categories?.name)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">{t("pending")}</h2>
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
                    {t("revoke")}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("noInvites")}
          </p>
        )}
      </section>
    </div>
  );
}
