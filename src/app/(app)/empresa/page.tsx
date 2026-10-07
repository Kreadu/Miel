import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { CompanyForm } from "./company-form";
import { StorePaymentsForm } from "./store-payments-form";
import { StoreSettingsForm } from "./store-settings-form";

export async function generateMetadata() {
  const t = await getTranslations("company");
  return { title: `${t("title")} · Miel` };
}

/** S26-01: datos de la empresa para los documentos (logo, dirección, contacto). Solo owner/admin. */
export default async function EmpresaPage() {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") notFound();
  const t = await getTranslations("company");

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("tenants")
    .select("name, nit, address, city, phone, email, logo_url, store_enabled, store_slug, store_color, store_nequi, store_daviplata, store_bank_info, store_payment_qr_url, store_cash_on_delivery, store_pay_in_store")
    .eq("id", active.tenantId)
    .maybeSingle();
  if (!company) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <CompanyForm values={company} />
      <StoreSettingsForm values={company} />
      <StorePaymentsForm values={company} />
    </div>
  );
}
