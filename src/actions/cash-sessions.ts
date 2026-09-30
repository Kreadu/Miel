"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity/log";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { closeCashSessionSchema, openCashSessionSchema } from "@/lib/validation/cash-sessions";

export type CashSessionState = { ok: false; error: string } | { ok: true } | null;

const CASH_PATH = "/ventas/caja";

function mapCashSessionError(message: string | undefined): string {
  if (message?.includes("cash_session_already_open")) return "cash.errors.alreadyOpen";
  if (message?.includes("cash_session_not_open")) return "cash.errors.notOpen";
  if (message?.includes("cash_session_not_found")) return "cash.errors.sessionInvalid";
  if (message?.includes("permission_denied")) return "common.errors.permissionDenied";
  if (message?.includes("opening_amount_invalid")) return "cash.errors.openingNegative";
  if (message?.includes("counted_amount_invalid")) return "cash.errors.countedNegative";
  return "cash.errors.failed";
}

export async function openCashSession(
  _prev: CashSessionState,
  formData: FormData,
): Promise<CashSessionState> {
  const parsed = openCashSessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.noActiveTenant" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("open_cash_session", {
    p_opening_amount: parsed.data.opening_amount,
    p_tenant_id: active.tenantId,
  });

  if (error) {
    console.error("openCashSession:", error.code, error.message);
    return { ok: false, error: mapCashSessionError(error.message) };
  }

  await logActivity("cash_opened", { detail: `Base ${parsed.data.opening_amount}` });
  revalidatePath(CASH_PATH);
  return { ok: true };
}

export async function closeCashSession(
  _prev: CashSessionState,
  formData: FormData,
): Promise<CashSessionState> {
  const parsed = closeCashSessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_cash_session", {
    p_counted_amount: parsed.data.counted_amount,
    p_session_id: (parsed.data.session_id || null) as unknown as string,
    p_note: parsed.data.note || undefined,
  });

  if (error) {
    console.error("closeCashSession:", error.code, error.message);
    return { ok: false, error: mapCashSessionError(error.message) };
  }

  await logActivity("cash_closed", { detail: `Contado ${parsed.data.counted_amount}` });
  revalidatePath(CASH_PATH);
  return { ok: true };
}
