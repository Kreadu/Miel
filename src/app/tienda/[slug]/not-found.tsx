import { getTranslations } from "next-intl/server";

/** S27-01: tienda apagada o inexistente — sin marca de nadie (ni de Miel ni de una empresa). */
export default async function StoreNotFound() {
  const t = await getTranslations("onlineStore");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-background px-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{t("unavailableTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("unavailableText")}</p>
    </main>
  );
}
