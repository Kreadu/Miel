"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";

import { isLocale } from "@/i18n/locales";
import { askModel, isAdvisorConfigured } from "@/lib/ai/advisor";
import { buildAdvisorContext, topProducts } from "@/lib/ai/advisor-context";
import { loadFinance, rangeBounds } from "@/lib/finance/load";
import { todayInBogota } from "@/lib/inventory-history";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { ADVISOR_DAILY_LIMIT, advisorQuestionSchema } from "@/lib/validation/advisor";

export type AdvisorState = { ok: true; answer: string } | { ok: false; error: string } | null;

const FAILED = "advisor.errors.failed";

/**
 * S22-03: pregunta de un dueño al asesor con IA. El navegador solo manda la pregunta y el rango;
 * los datos se arman aquí con la sesión del usuario (RLS) y la empresa activa. Solo owner/admin.
 */
export async function askAdvisor(_prev: AdvisorState, formData: FormData): Promise<AdvisorState> {
  const parsed = advisorQuestionSchema.safeParse({
    question: formData.get("question"),
    desde: formData.get("desde"),
    hasta: formData.get("hasta"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { question, desde, hasta } = parsed.data;
  const range = { from: desde, to: hasta };

  const { active } = await getActiveTenant();
  if (!active || active.role === "member") return { ok: false, error: "common.errors.permissionDenied" };
  if (!isAdvisorConfigured()) return { ok: false, error: "advisor.errors.notConfigured" };

  const supabase = await createClient();
  const { count } = await supabase
    .from("advisor_questions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", active.tenantId)
    .gte("created_at", `${todayInBogota()}T00:00:00-05:00`);
  if ((count ?? 0) >= ADVISOR_DAILY_LIMIT) {
    return { ok: false, error: "advisor.errors.dailyLimit" };
  }

  const { start, end } = rangeBounds(range);
  const [finance, items] = await Promise.all([
    loadFinance(supabase, active.tenantId, range),
    supabase
      .from("sale_items")
      .select("qty, unit_price, discount, unit_cost, products(name), sales!inner(tenant_id, status, issued_at)")
      .eq("sales.tenant_id", active.tenantId)
      .in("sales.status", ["confirmed", "shipped", "delivered"])
      .gte("sales.issued_at", start)
      .lt("sales.issued_at", end)
      .limit(10000),
  ]);
  if (items.error) {
    console.error("askAdvisor:", items.error.code);
    return { ok: false, error: FAILED };
  }

  const context = buildAdvisorContext({ range, ...finance, products: topProducts(items.data ?? [], 10) });
  const locale = await getLocale();
  const answer = await askModel(context, question, isLocale(locale) ? locale : "es");
  if (!answer.ok) {
    return {
      ok: false,
      error: answer.reason === "refused" ? "advisor.errors.refused" : FAILED,
    };
  }

  const { error } = await supabase.from("advisor_questions").insert({
    tenant_id: active.tenantId,
    question,
    answer: answer.text,
    range_from: desde,
    range_to: hasta,
  });
  if (error) console.error("askAdvisor: no se guardó la pregunta", error.code);

  revalidatePath("/resultados");
  return { ok: true, answer: answer.text };
}
