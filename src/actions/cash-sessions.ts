"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { closeCashSessionSchema, openCashSessionSchema } from "@/lib/validation/cash-sessions";

export type CashSessionState = { ok: false; error: string } | { ok: true } | null;

const CASH_PATH = "/ventas/caja";

function mapCashSessionError(message: string | undefined): string {
  if (message?.includes("cash_session_already_open")) return "Ya tienes una sesión de caja abierta.";
  if (message?.includes("cash_session_not_open")) return "No hay una sesión abierta para cerrar.";
  if (message?.includes("cash_session_not_found")) return "Sesión de caja inválida.";
  if (message?.includes("permission_denied")) return "No tienes permiso para esta operación.";
  if (message?.includes("opening_amount_invalid")) return "El monto base debe ser mayor o igual a cero.";
  if (message?.includes("counted_amount_invalid")) return "El monto contado debe ser mayor o igual a cero.";
  return "No se pudo completar la operación de caja. Intenta de nuevo.";
}

export async function openCashSession(
  _prev: CashSessionState,
  formData: FormData,
): Promise<CashSessionState> {
  const parsed = openCashSessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("open_cash_session", {
    p_opening_amount: parsed.data.opening_amount,
    p_tenant_id: active.tenantId,
  });

  if (error) {
    console.error("openCashSession:", error.code, error.message);
    return { ok: false, error: mapCashSessionError(error.message) };
  }

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

  revalidatePath(CASH_PATH);
  return { ok: true };
}
