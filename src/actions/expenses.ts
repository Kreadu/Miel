"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { expenseCategorySchema, expenseSchema } from "@/lib/validation/expenses";

export type ExpenseState = { ok: false; error: string } | { ok: true } | null;

const EXPENSES_PATH = "/gastos";
// Sentinel de los <Select> (Radix no admite value="").
const NONE = "__none__";

function mapExpenseError(code: string | undefined): string {
  if (code === "42501") return "common.errors.permissionDenied";
  if (code === "23514") return "expenses.errors.invalidData";
  return "expenses.errors.saveFailed";
}

function readExpense(formData: FormData) {
  const get = (k: string) => formData.get(k)?.toString();
  const supplier = get("supplier_id");
  return {
    kind: get("kind"),
    category: get("category") === NONE ? "" : get("category"),
    description: get("description"),
    amount: get("amount"),
    tax_amount: get("tax_amount"),
    method: get("method"),
    paid_on: get("paid_on"),
    supplier_id: supplier === NONE ? "" : supplier,
  };
}

/** Columnas explícitas (nunca spread del input). El tipo final lo corrige la BD según la categoría. */
function toColumns(d: z.infer<typeof expenseSchema>) {
  return {
    kind: d.kind,
    category: d.category,
    description: d.description,
    amount: d.amount,
    tax_amount: d.tax_amount,
    method: d.method,
    paid_at: d.paid_at,
    supplier_id: d.supplier_id,
  };
}

/** S22-01: solo owner/admin (RLS de expenses). */
export async function createExpense(_prev: ExpenseState, formData: FormData): Promise<ExpenseState> {
  const parsed = expenseSchema.safeParse(readExpense(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "common.errors.signInAgain" };

  const { error } = await supabase
    .from("expenses")
    .insert({ tenant_id: active.tenantId, created_by: user.id, ...toColumns(parsed.data) });
  if (error) {
    console.error("createExpense:", error.code);
    return { ok: false, error: mapExpenseError(error.code) };
  }
  revalidatePath(EXPENSES_PATH);
  return { ok: true };
}

export async function updateExpense(_prev: ExpenseState, formData: FormData): Promise<ExpenseState> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "expenses.errors.expenseInvalid" };
  const parsed = expenseSchema.safeParse(readExpense(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").update(toColumns(parsed.data)).eq("id", id.data);
  if (error) {
    console.error("updateExpense:", error.code);
    return { ok: false, error: mapExpenseError(error.code) };
  }
  revalidatePath(EXPENSES_PATH);
  return { ok: true };
}

export async function deleteExpense(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("expenses").delete().eq("id", id.data);
  revalidatePath(EXPENSES_PATH);
}

export type QuickExpenseCategoryResult = { ok: true; name: string } | { ok: false; error: string };

/** S22-01: "+" en la hoja de gastos — categoría propia con el tipo de esa hoja. */
export async function quickCreateExpenseCategory(input: {
  name: string;
  kind: string;
}): Promise<QuickExpenseCategoryResult> {
  const parsed = expenseCategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .insert({ tenant_id: active.tenantId, name: parsed.data.name, kind: parsed.data.kind })
    .select("name")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "expenses.errors.duplicateCategory" };
    console.error("quickCreateExpenseCategory:", error?.code);
    return { ok: false, error: "catalog.errors.createCategoryFailed" };
  }
  revalidatePath(EXPENSES_PATH);
  return { ok: true, name: data.name };
}
