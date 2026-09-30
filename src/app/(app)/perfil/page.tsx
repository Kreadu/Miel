import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { ProfileForm } from "./profile-form";

export async function generateMetadata() {
  const t = await getTranslations("profile");
  return { title: `${t("title")} · Miel` };
}

/**
 * S26-01: "Tu nombre" de la cuenta con correo en la empresa activa. En modo tienda no aplica:
 * ahí el nombre es el del trabajador identificado con su código.
 */
export default async function PerfilPage() {
  const { active } = await getActiveTenant();
  if (!active || active.storeMode) notFound();
  const t = await getTranslations("profile");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: membership } = await supabase
    .from("memberships")
    .select("display_name")
    .eq("tenant_id", active.tenantId)
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>
      <ProfileForm displayName={membership?.display_name ?? ""} />
    </div>
  );
}
