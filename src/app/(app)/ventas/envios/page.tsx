import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { RateForm } from "./rate-form";
import { RateRow } from "./rate-row";

export async function generateMetadata() {
  const t = await getTranslations("shipping");
  return { title: `${t("title")} · Miel` };
}

/**
 * S19-35: tipos de transporte y sus tarifas (base + por kg + por km). En el pedido, "Envío por
 * transporte" muestra una opción por cada uno con su valor según el peso y los km.
 */
export default async function EnviosPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();
  const canManage = active.role !== "member";
  const t = await getTranslations("shipping");

  const supabase = await createClient();
  const { data: rates } = await supabase
    .from("shipping_rates")
    .select("id, name, base_price, price_per_kg, price_per_km")
    .order("name", { ascending: true });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {canManage ? <RateForm /> : null}

      {rates && rates.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {rates.map((r) => (
            <RateRow key={r.id} id={r.id} values={r} canManage={canManage} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {canManage ? t("emptyManage") : t("emptyPublic")}
        </p>
      )}
    </div>
  );
}
