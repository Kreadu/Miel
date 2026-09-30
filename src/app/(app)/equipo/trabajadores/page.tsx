import { getTranslations } from "next-intl/server";

import { WorkersView } from "./workers-view";

export async function generateMetadata() {
  const t = await getTranslations("rrhh.workers");
  return { title: `${t("title")} · Miel` };
}

/** S21-02: trabajadores de planta. Los temporales y por horas están en /equipo/temporales. */
export default async function TrabajadoresPage() {
  const t = await getTranslations("rrhh.workers");
  return <WorkersView area="planta" title={t("title")} />;
}
