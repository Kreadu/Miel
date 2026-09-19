"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { customerSchema } from "@/lib/validation/customers";

export type CustomerState =
  | { ok: false; error: string }
  | { ok: true; customer?: { id: string; name: string } }
  | null;

const CUSTOMERS_PATH = "/ventas/clientes";

function mapCustomerError(code: string | undefined): string {
  if (code === "23505") return "Ya existe un cliente con ese tipo y número de documento.";
  return "No se pudo guardar el cliente. Intenta de nuevo.";
}

function toColumns(data: z.infer<typeof customerSchema>) {
  return {
    name: data.name,
    doc_type: data.doc_type,
    doc_number: data.doc_number || null,
    email: data.email || null,
    phone: data.phone || null,
    address: data.address || null,
    note: data.note || null,
  };
}

/**
 * Crear cliente: cualquier rol del tenant activo (owner/admin/member — ADR-033, S15-02).
 * Editar/archivar sigue restringido a owner/admin (RLS de update, sin cambios).
 */
export async function createCustomer(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({ tenant_id: active.tenantId, ...toColumns(parsed.data) })
    .select("id, name")
    .single();

  if (error) {
    console.error("createCustomer:", error.code);
    return { ok: false, error: mapCustomerError(error.code) };
  }

  // No se revalida /ventas/pos: el refetch de RSC remonta PosTerminal (la ruta tiene
  // loading.tsx) y borra el estado local del carrito y del cliente recién seleccionado
  // (hallazgo real en Playwright). La selección se resuelve por estado local
  // (QuickCustomerDialog → onCreated); /ventas/clientes sí necesita el dato fresco.
  revalidatePath(CUSTOMERS_PATH);
  return { ok: true, customer: data };
}

const updateSchema = customerSchema.extend({ id: z.uuid() });

export async function updateCustomer(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update(toColumns(parsed.data))
    .eq("id", parsed.data.id);
  
  if (error) {
    console.error("updateCustomer:", error.code);
    return { ok: false, error: mapCustomerError(error.code) };
  }

  revalidatePath(CUSTOMERS_PATH);
  return { ok: true };
}

const toggleSchema = z.object({ id: z.uuid(), active: z.enum(["true", "false"]) });

/** Archivar/reactivar (soft-delete): nunca DELETE físico. */
export async function toggleCustomerActive(formData: FormData): Promise<void> {
  const parsed = toggleSchema.safeParse({
    id: formData.get("id"),
    active: formData.get("active"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("customers")
    .update({ active: parsed.data.active === "true" })
    .eq("id", parsed.data.id);
  revalidatePath(CUSTOMERS_PATH);
}
