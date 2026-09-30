import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getActiveTenant } from "@/lib/tenant/server";

import { ExitForm } from "./exit-form";

export async function generateMetadata() {
  const t = await getTranslations("store");
  return { title: `${t("exit")} · Miel` };
}

export default async function SalirModoTiendaPage() {
  const { active } = await getActiveTenant();
  if (!active) redirect("/onboarding");
  if (!active.storeMode) redirect("/inicio");
  const t = await getTranslations("store");

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">{t("exit")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("exitDescription")}
          </p>
        </div>
        <ExitForm />
        <Link href="/trabajador" className="text-center text-xs text-muted-foreground underline underline-offset-4">
          {t("back")}
        </Link>
      </div>
    </main>
  );
}
