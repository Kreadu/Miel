import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { DianForm } from "./dian-form";

export async function generateMetadata() {
  const t = await getTranslations("rrhh.dian");
  return { title: `${t("title")} · Miel` };
}

/** S21-05: datos de la empresa para la nómina electrónica (solo owner/admin). */
export default async function DianPage() {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") notFound();

  const supabase = await createClient();
  const t = await getTranslations("rrhh.dian");
  const { data: settings } = await supabase
    .from("dian_settings")
    .select("nit, dv, company_name, software_id, software_pin, test_set_id, address, city, department, email, phone")
    .maybeSingle();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>
      <DianForm values={settings ?? undefined} />
    </div>
  );
}
