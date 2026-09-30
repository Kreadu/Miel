import { Activity, BriefcaseBusiness, Clock, HandCoins, HeartPulse, Mail, Tags, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getActiveTenant } from "@/lib/tenant/server";

export async function generateMetadata() {
  const t = await getTranslations("rrhh");
  return { title: `${t("title")} · Miel` };
}

const LINK_CLASS =
  "inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80";

/** RRHH: accesos a cada sección (S21-03: miembros e invitaciones en "Usuarios con correo"). */
export default async function EquipoPage() {
  const { active } = await getActiveTenant();
  // UX (nextjs-miel): recurso que el rol no debería ver → notFound(), nunca un 403.
  if (!active || active.role === "member") notFound();
  const t = await getTranslations("rrhh");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{active.tenantName}</p>
        </div>
        {/* S21-02: trabajadores y sus categorías (qué ve cada uno). */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/equipo/trabajadores" className={LINK_CLASS}>
            <UserRound className="mr-2 h-4 w-4" />
            {t("links.workers")}
          </Link>
          <Link
            href="/equipo/nomina"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <HandCoins className="mr-2 h-4 w-4" />
            {t("links.payroll")}
          </Link>
          <Link href="/equipo/licencias" className={LINK_CLASS}>
            <HeartPulse className="mr-2 h-4 w-4" />
            {t("links.leaves")}
          </Link>
          <Link href="/equipo/temporales" className={LINK_CLASS}>
            <Clock className="mr-2 h-4 w-4" />
            {t("links.temporary")}
          </Link>
          <Link href="/equipo/cargos" className={LINK_CLASS}>
            <BriefcaseBusiness className="mr-2 h-4 w-4" />
            {t("links.positions")}
          </Link>
          <Link href="/equipo/categorias" className={LINK_CLASS}>
            <Tags className="mr-2 h-4 w-4" />
            {t("links.categories")}
          </Link>
          <Link href="/equipo/uso" className={LINK_CLASS}>
            <Activity className="mr-2 h-4 w-4" />
            {t("links.usage")}
          </Link>
          <Link href="/equipo/usuarios" className={LINK_CLASS}>
            <Mail className="mr-2 h-4 w-4" />
            {t("links.users")}
          </Link>
        </div>
      </div>
    </div>
  );
}
