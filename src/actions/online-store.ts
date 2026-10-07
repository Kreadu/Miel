"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isValidStoreSlug, normalizeStoreSlug, RESERVED_SLUGS } from "@/lib/store/slug";
import { LOGO_TYPES, MAX_LOGO_BYTES } from "@/lib/validation/company";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

export type StoreState = { ok: false; error: string } | { ok: true } | null;

const storeSchema = z
  .object({
    enabled: z.boolean(),
    slug: z
      .string()
      .transform(normalizeStoreSlug)
      .refine((s) => !RESERVED_SLUGS.has(s), "onlineStore.errors.slugReserved")
      .refine((s) => s === "" || isValidStoreSlug(s), "onlineStore.errors.slugInvalid"),
    color: z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/, "onlineStore.errors.colorInvalid")]),
  })
  .refine((v) => !v.enabled || v.slug !== "", { message: "onlineStore.errors.slugRequired" });

/**
 * S27-01: ajustes de la tienda en línea. Igual que "Mi empresa": la RLS de tenants solo deja
 * actualizar al admin, y los CHECK de la BD repiten estas reglas (no se pueden saltar).
 */
export async function saveStoreSettings(_prev: StoreState, formData: FormData): Promise<StoreState> {
  const parsed = storeSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    slug: formData.get("slug")?.toString() ?? "",
    color: formData.get("color")?.toString() ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .update({
      store_enabled: parsed.data.enabled,
      store_slug: parsed.data.slug || null,
      store_color: parsed.data.color || null,
    })
    .eq("id", active.tenantId)
    .select("id");
  if (error) {
    console.error("saveStoreSettings:", error.code);
    return { ok: false, error: error.code === "23505" ? "onlineStore.errors.slugTaken" : "onlineStore.errors.saveFailed" };
  }
  if (!data?.length) return { ok: false, error: "common.errors.permissionDenied" };

  revalidatePath("/empresa");
  return { ok: true };
}

const wallet = z
  .string()
  .trim()
  .refine((v) => v === "" || /^[\d\s+()-]+$/.test(v), "onlineStore.errors.walletInvalid")
  .refine((v) => v === "" || (v.replace(/\D/g, "").length >= 7 && v.replace(/\D/g, "").length <= 15), "onlineStore.errors.walletInvalid")
  .transform((v) => v || null);

const paymentsSchema = z.object({
  nequi: wallet,
  daviplata: wallet,
  bank_info: z.string().trim().max(300, "common.errors.textTooLong").transform((v) => v || null),
  cash_on_delivery: z.boolean(),
  pay_in_store: z.boolean(),
});

const QR_EXT: Record<(typeof LOGO_TYPES)[number], string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * S27-03: formas de pago de la tienda. El QR va al bucket público de logos (es público a
 * propósito: el cliente lo escanea), en la carpeta de la empresa.
 */
export async function saveStorePayments(_prev: StoreState, formData: FormData): Promise<StoreState> {
  const parsed = paymentsSchema.safeParse({
    nequi: formData.get("nequi")?.toString() ?? "",
    daviplata: formData.get("daviplata")?.toString() ?? "",
    bank_info: formData.get("bank_info")?.toString() ?? "",
    cash_on_delivery: formData.get("cash_on_delivery") === "on",
    pay_in_store: formData.get("pay_in_store") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const qr = formData.get("qr");
  const hasQr = qr instanceof File && qr.size > 0;
  if (hasQr) {
    if (!(LOGO_TYPES as readonly string[]).includes(qr.type)) return { ok: false, error: "company.errors.logoType" };
    if (qr.size > MAX_LOGO_BYTES) return { ok: false, error: "company.errors.logoSize" };
  }

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const supabase = await createClient();
  let qrUrl: string | null | undefined;
  if (hasQr) {
    const path = `${active.tenantId}/qr-${crypto.randomUUID()}.${QR_EXT[qr.type as (typeof LOGO_TYPES)[number]]}`;
    const { error } = await supabase.storage.from("company-logos").upload(path, qr, { contentType: qr.type });
    if (error) {
      console.error("saveStorePayments qr:", error.message);
      return { ok: false, error: "company.errors.logoUpload" };
    }
    qrUrl = supabase.storage.from("company-logos").getPublicUrl(path).data.publicUrl;
  } else if (formData.get("remove_qr") === "on") {
    qrUrl = null;
  }

  const p = parsed.data;
  const { data, error } = await supabase
    .from("tenants")
    .update({
      store_nequi: p.nequi,
      store_daviplata: p.daviplata,
      store_bank_info: p.bank_info,
      store_cash_on_delivery: p.cash_on_delivery,
      store_pay_in_store: p.pay_in_store,
      ...(qrUrl !== undefined ? { store_payment_qr_url: qrUrl } : {}),
    })
    .eq("id", active.tenantId)
    .select("id");
  if (error) {
    console.error("saveStorePayments:", error.code);
    return { ok: false, error: "onlineStore.errors.saveFailed" };
  }
  if (!data?.length) return { ok: false, error: "common.errors.permissionDenied" };

  revalidatePath("/empresa");
  return { ok: true };
}
