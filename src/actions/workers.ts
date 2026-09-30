"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { workerCategorySchema, workerSchema } from "@/lib/validation/workers";

export type WorkerState = { ok: false; error: string } | { ok: true } | null;

// Mismo sentinel que los <Select> de los formularios (Radix no admite value="").
const NONE = "__none__";

function revalidateRrhh() {
  revalidatePath("/equipo", "layout");
}

// ---------- Categorías ----------

function readCategory(formData: FormData) {
  return {
    name: formData.get("name")?.toString(),
    modules: formData.getAll("modules").map((m) => m.toString()),
  };
}

function mapCategoryError(code: string | undefined): string {
  if (code === "23505") return "Ya existe una categoría con ese nombre.";
  return "No se pudo guardar la categoría. Intenta de nuevo.";
}

/** S21-02: solo owner/admin (RLS de worker_categories). */
export async function createWorkerCategory(_prev: WorkerState, formData: FormData): Promise<WorkerState> {
  const parsed = workerCategorySchema.safeParse(readCategory(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const { error } = await supabase.from("worker_categories").insert({
    tenant_id: active.tenantId,
    name: parsed.data.name,
    modules: parsed.data.modules,
  });
  if (error) {
    console.error("createWorkerCategory:", error.code);
    return { ok: false, error: mapCategoryError(error.code) };
  }
  revalidateRrhh();
  return { ok: true };
}

const updateCategorySchema = workerCategorySchema.extend({ id: z.uuid() });

export async function updateWorkerCategory(_prev: WorkerState, formData: FormData): Promise<WorkerState> {
  const parsed = updateCategorySchema.safeParse({ ...readCategory(formData), id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("worker_categories")
    .update({ name: parsed.data.name, modules: parsed.data.modules })
    .eq("id", parsed.data.id);
  if (error) {
    console.error("updateWorkerCategory:", error.code);
    return { ok: false, error: mapCategoryError(error.code) };
  }
  revalidateRrhh();
  return { ok: true };
}

/** Borrar una categoría deja a sus trabajadores sin categoría (on delete set null). */
export async function deleteWorkerCategory(formData: FormData): Promise<void> {
  const parsed = z.uuid().safeParse(formData.get("id"));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("worker_categories").delete().eq("id", parsed.data);
  revalidateRrhh();
}

// ---------- Trabajadores ----------

const WORKER_FIELDS = [
  "full_name",
  "doc_type",
  "doc_number",
  "position",
  "hire_date",
  "contract_type",
  "salary",
  "work_schedule",
  "eps",
  "pension_fund",
  "arl_risk_class",
  "phone",
  "email",
  "address",
  "warehouse_id",
  "category_id",
] as const;

function readWorker(formData: FormData) {
  const fields: Record<string, string | undefined> = {};
  for (const f of WORKER_FIELDS) {
    const v = formData.get(f)?.toString();
    fields[f] = v === NONE ? "" : v;
  }
  return fields;
}

/** Columnas explícitas (nunca spread del input) a partir del resultado validado. */
function toColumns(d: z.infer<typeof workerSchema>) {
  return {
    full_name: d.full_name,
    doc_type: d.doc_type,
    doc_number: d.doc_number,
    position: d.position,
    hire_date: d.hire_date,
    contract_type: d.contract_type,
    salary: d.salary,
    work_schedule: d.work_schedule,
    eps: d.eps,
    pension_fund: d.pension_fund,
    arl_risk_class: d.arl_risk_class,
    phone: d.phone,
    email: d.email,
    address: d.address,
    warehouse_id: d.warehouse_id || null,
    category_id: d.category_id || null,
  };
}

function mapWorkerError(code: string | undefined, message?: string): string {
  if (code === "23505") return "Ya existe un trabajador con ese documento.";
  if (message?.includes("category_invalid")) return "Elige una categoría válida.";
  if (message?.includes("warehouse_invalid")) return "Elige una bodega o sucursal válida.";
  return "No se pudo guardar el trabajador. Intenta de nuevo.";
}

/** S21-02: solo owner/admin (RLS de workers; hay salario y datos personales). */
export async function createWorker(_prev: WorkerState, formData: FormData): Promise<WorkerState> {
  const parsed = workerSchema.safeParse(readWorker(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("workers")
    .insert({ tenant_id: active.tenantId, ...toColumns(parsed.data) });
  if (error) {
    console.error("createWorker:", error.code);
    return { ok: false, error: mapWorkerError(error.code, error.message) };
  }
  revalidateRrhh();
  return { ok: true };
}

const updateWorkerSchema = workerSchema.extend({ id: z.uuid() });

export async function updateWorker(_prev: WorkerState, formData: FormData): Promise<WorkerState> {
  const parsed = updateWorkerSchema.safeParse({ ...readWorker(formData), id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("workers").update(toColumns(parsed.data)).eq("id", parsed.data.id);
  if (error) {
    console.error("updateWorker:", error.code);
    return { ok: false, error: mapWorkerError(error.code, error.message) };
  }
  revalidateRrhh();
  return { ok: true };
}

const toggleSchema = z.object({ id: z.uuid(), active: z.enum(["true", "false"]) });

/** Archivar/reactivar (borrado lógico): el registro de uso (S21-04) referenciará al trabajador. */
export async function toggleWorkerActive(formData: FormData): Promise<void> {
  const parsed = toggleSchema.safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase
    .from("workers")
    .update({ active: parsed.data.active === "true" })
    .eq("id", parsed.data.id);
  revalidateRrhh();
}
