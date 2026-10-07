"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isValidStoreSlug, normalizeStoreSlug, RESERVED_SLUGS } from "@/lib/store/slug";
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
