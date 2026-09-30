import { getTranslations } from "next-intl/server";

import { WorkersView } from "../trabajadores/workers-view";

export async function generateMetadata() {
  const t = await getTranslations("rrhh.workers");
  return { title: `${t("temporaryTitle")} · Miel` };
}

/** S21-02c: área aparte para trabajadores temporales (con fecha de término) o por horas. */
export default async function TemporalesPage() {
  const t = await getTranslations("rrhh.workers");
  return <WorkersView area="temporales" title={t("temporaryTitle")} />;
}
