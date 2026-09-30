import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { DianForm } from "./dian-form";

export const metadata = { title: "Datos DIAN · Miel" };

/** S21-05: datos de la empresa para la nómina electrónica (solo owner/admin). */
export default async function DianPage() {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") notFound();

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("dian_settings")
    .select("nit, dv, company_name, software_id, software_pin, test_set_id, address, city, department, email, phone")
    .maybeSingle();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Datos DIAN</h1>
        <p className="text-sm text-muted-foreground">
          Los datos de tu empresa y del software de nómina electrónica que te habilitó la DIAN. Van en
          cada XML que generes.
        </p>
      </div>
      <DianForm values={settings ?? undefined} />
    </div>
  );
}
