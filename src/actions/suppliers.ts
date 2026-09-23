"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { supplierSchema } from "@/lib/validation/suppliers";

export type SupplierState = { ok: false; error: string } | { ok: true } | null;

const SUPPLIERS_PATH = "/compras/proveedores";

function mapSupplierError(code: string | undefined): string {
  if (code === "23505") return "Ya existe un proveedor con ese NIT.";
  return "No se pudo guardar el proveedor. Intenta de nuevo.";
}

function toColumns(data: z.infer<typeof supplierSchema>) {
  return {
    name: data.name,
    nit: data.nit || null,
    email: data.email || null,
    phone: data.phone || null,
    address: data.address || null,
  };
}

/** Solo owner/admin del tenant activo gestionan proveedores (RLS de suppliers lo garantiza igual). */
export async function createSupplier(
  _prev: SupplierState,
  formData: FormData,
): Promise<SupplierState> {
  const parsed = supplierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .insert({ tenant_id: active.tenantId, ...toColumns(parsed.data) });
  if (error) {
    console.error("createSupplier:", error.code);
    return { ok: false, error: mapSupplierError(error.code) };
  }

  revalidatePath(SUPPLIERS_PATH);
  return { ok: true };
}

const updateSchema = supplierSchema.extend({ id: z.uuid() });

export async function updateSupplier(
  _prev: SupplierState,
  formData: FormData,
): Promise<SupplierState> {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update(toColumns(parsed.data))
    .eq("id", parsed.data.id);
  if (error) {
    console.error("updateSupplier:", error.code);
    return { ok: false, error: mapSupplierError(error.code) };
  }

  revalidatePath(SUPPLIERS_PATH);
  return { ok: true };
}

const toggleSchema = z.object({ id: z.uuid(), active: z.enum(["true", "false"]) });

/** Archivar/reactivar (soft-delete): nunca DELETE físico — purchases (S3-02) referenciará supplier_id. */
export async function toggleSupplierActive(formData: FormData): Promise<void> {
  const parsed = toggleSchema.safeParse({
    id: formData.get("id"),
    active: formData.get("active"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("suppliers")
    .update({ active: parsed.data.active === "true" })
    .eq("id", parsed.data.id);
  revalidatePath(SUPPLIERS_PATH);
}
