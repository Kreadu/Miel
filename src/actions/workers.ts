"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { workerCategorySchema, workerPositionSchema, workerSchema } from "@/lib/validation/workers";

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
  if (code === "23505") return "expenses.errors.duplicateCategory";
  return "workers.errors.categorySaveFailed";
}

/** S21-02: solo owner/admin (RLS de worker_categories). */
export async function createWorkerCategory(_prev: WorkerState, formData: FormData): Promise<WorkerState> {
  const parsed = workerCategorySchema.safeParse(readCategory(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

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

export type QuickCategoryResult =
  | { ok: false; error: string }
  | { ok: true; category: { id: string; name: string } };

/**
 * S21-02b: "+" junto a Categoría en la ficha del trabajador — crea la categoría y la devuelve
 * para dejarla elegida sin salir del formulario.
 */
export async function quickCreateWorkerCategory(input: {
  name: string;
  modules: string[];
}): Promise<QuickCategoryResult> {
  const parsed = workerCategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("worker_categories")
    .insert({ tenant_id: active.tenantId, name: parsed.data.name, modules: parsed.data.modules })
    .select("id, name")
    .single();
  if (error || !data) {
    console.error("quickCreateWorkerCategory:", error?.code);
    return { ok: false, error: mapCategoryError(error?.code) };
  }
  revalidateRrhh();
  return { ok: true, category: data };
}

/** Borrar una categoría deja a sus trabajadores sin categoría (on delete set null). */
export async function deleteWorkerCategory(formData: FormData): Promise<void> {
  const parsed = z.uuid().safeParse(formData.get("id"));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("worker_categories").delete().eq("id", parsed.data);
  revalidateRrhh();
}

// ---------- Cargos (S21-02c) ----------

function mapPositionError(code: string | undefined): string {
  if (code === "23505") return "workers.errors.duplicatePosition";
  return "workers.errors.positionSaveFailed";
}

export async function createWorkerPosition(_prev: WorkerState, formData: FormData): Promise<WorkerState> {
  const result = await quickCreateWorkerPosition(formData.get("name")?.toString() ?? "");
  return result.ok ? { ok: true } : result;
}

export async function updateWorkerPosition(_prev: WorkerState, formData: FormData): Promise<WorkerState> {
  const parsed = workerPositionSchema
    .extend({ id: z.uuid() })
    .safeParse({ name: formData.get("name"), id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("worker_positions")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id);
  if (error) {
    console.error("updateWorkerPosition:", error.code);
    return { ok: false, error: mapPositionError(error.code) };
  }
  revalidateRrhh();
  return { ok: true };
}

/** Borrar un cargo deja a sus trabajadores sin cargo (on delete set null). */
export async function deleteWorkerPosition(formData: FormData): Promise<void> {
  const parsed = z.uuid().safeParse(formData.get("id"));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("worker_positions").delete().eq("id", parsed.data);
  revalidateRrhh();
}

export type QuickPositionResult =
  | { ok: false; error: string }
  | { ok: true; position: { id: string; name: string } };

/** "+" junto a Cargo en la ficha del trabajador: crea el cargo y lo devuelve para elegirlo. */
export async function quickCreateWorkerPosition(name: string): Promise<QuickPositionResult> {
  const parsed = workerPositionSchema.safeParse({ name });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("worker_positions")
    .insert({ tenant_id: active.tenantId, name: parsed.data.name })
    .select("id, name")
    .single();
  if (error || !data) {
    console.error("quickCreateWorkerPosition:", error?.code);
    return { ok: false, error: mapPositionError(error?.code) };
  }
  revalidateRrhh();
  return { ok: true, position: data };
}

// ---------- Trabajadores ----------

const WORKER_FIELDS = [
  "full_name",
  "doc_type",
  "doc_number",
  "position_id",
  "hire_date",
  "worker_type",
  "end_date",
  "hourly_rate",
  "contract_type",
  "salary",
  "work_schedule",
  "eps",
  "pension_fund",
  "arl_risk_class",
  "phone",
  "email",
  "address",
  "emergency_contact_name",
  "emergency_phone",
  "cost_classification",
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
    position_id: d.position_id || null,
    hire_date: d.hire_date,
    worker_type: d.worker_type,
    end_date: d.end_date,
    hourly_rate: d.hourly_rate,
    contract_type: d.contract_type,
    salary: d.salary,
    work_schedule: d.work_schedule,
    eps: d.eps,
    pension_fund: d.pension_fund,
    arl_risk_class: d.arl_risk_class,
    phone: d.phone,
    email: d.email,
    address: d.address,
    emergency_contact_name: d.emergency_contact_name,
    emergency_phone: d.emergency_phone,
    cost_classification: d.cost_classification,
    warehouse_id: d.warehouse_id || null,
    category_id: d.category_id || null,
  };
}

function mapWorkerError(code: string | undefined, message?: string): string {
  if (code === "23505") return "workers.errors.duplicateDoc";
  if (message?.includes("category_invalid")) return "workers.errors.categoryInvalid";
  if (message?.includes("position_invalid")) return "workers.errors.positionInvalid";
  if (message?.includes("warehouse_invalid")) return "purchases.errors.warehouseInvalid";
  return "workers.errors.saveFailed";
}

/** S21-02: solo owner/admin (RLS de workers; hay salario y datos personales). */
export async function createWorker(_prev: WorkerState, formData: FormData): Promise<WorkerState> {
  const parsed = workerSchema.safeParse(readWorker(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

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

/** S21-02b: borrar trabajador (solo owner/admin por RLS). 0 filas = sin permiso o ya no existe. */
export async function deleteWorker(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "workers.errors.workerInvalid" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("workers").delete().eq("id", parsed.data).select("id");
  if (error || !data?.length) {
    if (error) console.error("deleteWorker:", error.code);
    return { ok: false, error: "workers.errors.deleteFailed" };
  }
  revalidateRrhh();
  return { ok: true };
}

// ---------- Acceso con código (S21-03, ADR-037) ----------

const pinAccessSchema = z
  .object({
    worker_id: z.uuid(),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._-]{3,30}$/, "workers.errors.usernameFormat"),
    pin: z.string().regex(/^\d{4}$/, "store.errors.pinFormat"),
    pin_confirm: z.string(),
  })
  .refine((d) => d.pin === d.pin_confirm, { message: "workers.errors.pinMismatch", path: ["pin_confirm"] });

/** Asigna (o cambia) usuario y código. El código se guarda solo como hash, en la BD. */
export async function setWorkerPinAccess(_prev: WorkerState, formData: FormData): Promise<WorkerState> {
  const parsed = pinAccessSchema.safeParse({
    worker_id: formData.get("worker_id"),
    username: formData.get("username"),
    pin: formData.get("pin"),
    pin_confirm: formData.get("pin_confirm"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_worker_pin", {
    p_worker_id: parsed.data.worker_id,
    p_username: parsed.data.username,
    p_pin: parsed.data.pin,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "workers.errors.usernameTaken" };
    console.error("setWorkerPinAccess:", error.code);
    return { ok: false, error: "workers.errors.accessSaveFailed" };
  }
  revalidateRrhh();
  return { ok: true };
}

export async function clearWorkerPinAccess(formData: FormData): Promise<void> {
  const parsed = z.uuid().safeParse(formData.get("worker_id"));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.rpc("clear_worker_pin", { p_worker_id: parsed.data });
  revalidateRrhh();
}
