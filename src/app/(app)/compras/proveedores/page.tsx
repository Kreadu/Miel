import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createSupplier } from "@/actions/suppliers";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { SupplierForm } from "./supplier-form";
import { SupplierRow } from "./supplier-row";

export async function generateMetadata() {
  const t = await getTranslations("suppliers");
  return { title: `${t("title")} · Miel` };
}

export default async function ProveedoresPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const canManage = active.role !== "member";
  const t = await getTranslations("suppliers");

  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, nit, email, phone, address, active")
    .order("name", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{active.tenantName}</p>
      </div>

      {canManage ? (
        <SupplierForm
          action={createSupplier}
          submitLabel={t("create")}
          pendingLabel={t("creating")}
        />
      ) : null}

      {suppliers && suppliers.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("name")}</th>
                <th className="px-3 py-2 font-medium">{t("nit")}</th>
                <th className="px-3 py-2 font-medium">{t("email")}</th>
                <th className="px-3 py-2 font-medium">{t("phone")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <SupplierRow
                  key={s.id}
                  canManage={canManage}
                  supplier={{
                    id: s.id,
                    name: s.name,
                    nit: s.nit,
                    email: s.email,
                    phone: s.phone,
                    address: s.address,
                    active: s.active,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {canManage ? t("emptyManage") : t("emptyPublic")}
        </p>
      )}
    </div>
  );
}
