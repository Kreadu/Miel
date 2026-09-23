"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { fromDatetimeLocalValue } from "@/lib/format";
import { getActiveTenant } from "@/lib/tenant/server";
import { expenseSchema } from "@/lib/validation/expenses";

export type ExpenseState = { ok: false; error: string } | { ok: true } | null;

const EXPENSES_PATH = "/gastos";

function mapExpenseError(code: string | undefined): string {
  if (code === "42501") return "No tienes permiso para gestionar gastos.";
  if (code === "23514") return "Los datos del gasto no cumplen las reglas de validación (monto o tipo inválidos).";
  return "No se pudo guardar el gasto. Intenta de nuevo.";
}

// El <input type="datetime-local"> envía "YYYY-MM-DDTHH:mm" (hora Bogotá, sin offset) — se
// convierte a ISO UTC antes de que expenseSchema.safeParse lo valide con z.string().datetime().
function parsePaidAt(raw: FormDataEntryValue | undefined): string | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  try {
    return fromDatetimeLocalValue(raw);
  } catch {
    return undefined; // input datetime-local inválido -> cae al default de toColumns
  }
}

function toColumns(data: z.infer<typeof expenseSchema>) {
  return {
    kind: data.kind,
    category: data.category,
    description: data.description,
    amount: data.amount,
    method: data.method,
    paid_at: data.paid_at || new Date().toISOString(),
    supplier_id: data.supplier_id || null,
  };
}

export async function createExpense(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  // Amount comes as string, so we need to override the parsing for amount
  const obj = Object.fromEntries(formData);
  const dataToParse = {
    ...obj,
    amount: obj.amount ? parseFloat(obj.amount as string) : undefined,
    supplier_id: obj.supplier_id === "__none__" || !obj.supplier_id ? undefined : obj.supplier_id,
    paid_at: parsePaidAt(obj.paid_at),
  };

  const parsed = expenseSchema.safeParse(dataToParse);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { error } = await supabase
    .from("expenses")
    .insert({ tenant_id: active.tenantId, created_by: user.id, ...toColumns(parsed.data) });
    
  if (error) {
    console.error("createExpense:", error);
    return { ok: false, error: mapExpenseError(error.code) };
  }

  revalidatePath(EXPENSES_PATH);
  return { ok: true };
}

const updateSchema = expenseSchema.extend({ id: z.string().uuid() });

export async function updateExpense(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  const obj = Object.fromEntries(formData);
  const dataToParse = {
    ...obj,
    amount: obj.amount ? parseFloat(obj.amount as string) : undefined,
    supplier_id: obj.supplier_id === "__none__" || !obj.supplier_id ? undefined : obj.supplier_id,
    paid_at: parsePaidAt(obj.paid_at),
  };

  const parsed = updateSchema.safeParse(dataToParse);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update(toColumns(parsed.data))
    .eq("id", parsed.data.id);
    
  if (error) {
    console.error("updateExpense:", error);
    return { ok: false, error: mapExpenseError(error.code) };
  }

  revalidatePath(EXPENSES_PATH);
  return { ok: true };
}

export async function deleteExpense(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (!id || typeof id !== "string") return;

  const supabase = await createClient();
  await supabase.from("expenses").delete().eq("id", id);
  revalidatePath(EXPENSES_PATH);
}
