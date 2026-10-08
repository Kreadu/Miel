"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { companySchema, LOGO_TYPES, MAX_LOGO_BYTES } from "@/lib/validation/company";

export type CompanyState = { ok: false; error: string } | { ok: true } | null;

const LOGO_EXT: Record<(typeof LOGO_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * S26-01: datos de la empresa y logo (solo owner/admin: la RLS de tenants no actualiza nada a un
 * operativo, y el bucket company-logos solo deja escribir al admin en la carpeta de su empresa).
 */
export async function saveCompany(_prev: CompanyState, formData: FormData): Promise<CompanyState> {
  const get = (k: string) => formData.get(k)?.toString();
  const parsed = companySchema.safeParse({
    name: get("name"),
    nit: get("nit"),
    address: get("address"),
    city: get("city"),
    phone: get("phone"),
    email: get("email"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const logo = formData.get("logo");
  const hasLogo = logo instanceof File && logo.size > 0;
  if (hasLogo) {
    if (!(LOGO_TYPES as readonly string[]).includes(logo.type)) return { ok: false, error: "company.errors.logoType" };
    if (logo.size > MAX_LOGO_BYTES) return { ok: false, error: "company.errors.logoSize" };
  }

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const supabase = await createClient();
  let logoUrl: string | null | undefined;
  if (hasLogo) {
    const path = `${active.tenantId}/${crypto.randomUUID()}.${LOGO_EXT[logo.type as (typeof LOGO_TYPES)[number]]}`;
    const { error } = await supabase.storage.from("company-logos").upload(path, logo, { contentType: logo.type });
    if (error) {
      console.error("saveCompany logo:", error.message);
      return { ok: false, error: "company.errors.logoUpload" };
    }
    logoUrl = supabase.storage.from("company-logos").getPublicUrl(path).data.publicUrl;
  } else if (get("remove_logo") === "on") {
    logoUrl = null;
  }

  const { data, error } = await supabase
    .from("tenants")
    .update({ ...parsed.data, ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}) })
    .eq("id", active.tenantId)
    .select("id");
  if (error) {
    console.error("saveCompany:", error.code);
    return { ok: false, error: "company.errors.saveFailed" };
  }
  if (!data?.length) return { ok: false, error: "common.errors.permissionDenied" };

  revalidatePath("/", "layout");
  return { ok: true };
}
