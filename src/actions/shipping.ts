"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { shippingRateSchema } from "@/lib/validation/shipping";

export type ShippingRateState = { ok: false; error: string } | { ok: true } | null;

const ENVIOS_PATH = "/ventas/envios";

function readFields(formData: FormData) {
  const get = (k: string) => formData.get(k)?.toString() || undefined;
  return {
    name: get("name"),
    base_price: get("base_price"),
    price_per_kg: get("price_per_kg"),
    price_per_km: get("price_per_km"),
  };
}

function mapError(code: string | undefined): string {
  if (code === "23505") return "Ya existe un transporte con ese nombre.";
  return "No se pudo guardar el transporte. Intenta de nuevo.";
}

/** S19-35: solo owner/admin gestionan tarifas (RLS de shipping_rates lo garantiza igual). */
export async function createShippingRate(
  _prev: ShippingRateState,
  formData: FormData,
): Promise<ShippingRateState> {
  const parsed = shippingRateSchema.safeParse(readFields(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const { error } = await supabase.from("shipping_rates").insert({
    tenant_id: active.tenantId,
    name: parsed.data.name,
    base_price: parsed.data.base_price,
    price_per_kg: parsed.data.price_per_kg,
    price_per_km: parsed.data.price_per_km,
  });
  if (error) {
    console.error("createShippingRate:", error.code);
    return { ok: false, error: mapError(error.code) };
  }
  revalidatePath(ENVIOS_PATH);
  return { ok: true };
}

const updateSchema = shippingRateSchema.extend({ id: z.uuid() });

export async function updateShippingRate(
  _prev: ShippingRateState,
  formData: FormData,
): Promise<ShippingRateState> {
  const parsed = updateSchema.safeParse({ ...readFields(formData), id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("shipping_rates")
    .update({
      name: parsed.data.name,
      base_price: parsed.data.base_price,
      price_per_kg: parsed.data.price_per_kg,
      price_per_km: parsed.data.price_per_km,
    })
    .eq("id", parsed.data.id);
  if (error) {
    console.error("updateShippingRate:", error.code);
    return { ok: false, error: mapError(error.code) };
  }
  revalidatePath(ENVIOS_PATH);
  return { ok: true };
}

/** Borrado físico: las ventas guardan el costo del envío; su shipping_rate_id queda en null. */
export async function deleteShippingRate(formData: FormData): Promise<void> {
  const parsed = z.uuid().safeParse(formData.get("id"));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("shipping_rates").delete().eq("id", parsed.data);
  revalidatePath(ENVIOS_PATH);
}
