"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { dianEmployeeExtra, defaultDaysWorked, type Employer, leavesInPeriod } from "@/lib/rrhh/payroll-input";
import { liquidateWorker, type LiquidationWorker, type SettlementNovelties } from "@/lib/rrhh/liquidate";
import { DianNominaXmlService } from "@/lib/rrhh/services/dianNominaXmlService";
import type { ColombiaPayrollResult } from "@/lib/rrhh/types/payroll";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import { dianSettingsSchema, leaveSchema, noveltiesSchema, periodSchema } from "@/lib/validation/payroll";

export type PayrollState = { ok: false; error: string } | { ok: true } | null;

type Supabase = Awaited<ReturnType<typeof createClient>>;

const WORKER_COLUMNS =
  "id, full_name, doc_type, doc_number, contract_type, salary, hourly_rate, arl_risk_class, worker_type, hire_date, end_date";

function revalidatePayroll() {
  revalidatePath("/equipo", "layout");
}

async function tenantOrError() {
  const { active } = await getActiveTenant();
  return active;
}

/** Guarda el resultado del motor (o su error, para mostrarlo en la nómina). */
function settlementValues(
  tenantId: string,
  worker: LiquidationWorker,
  novelties: SettlementNovelties,
  leaves: { type: string; start_date: string; end_date: string }[],
  period: { start: string; end: string },
  employer: Employer,
) {
  const liq = liquidateWorker(tenantId, worker, novelties, leaves, period, employer);
  return {
    ...novelties,
    gross_earnings: liq.ok ? liq.gross_earnings : 0,
    total_deductions: liq.ok ? liq.total_deductions : 0,
    net_pay: liq.ok ? liq.net_pay : 0,
    result: liq.ok ? liq.result : { error: liq.error },
  };
}

/** S23-01: tipo de persona de la empresa y trabajadores con contrato laboral (exoneración 114-1). */
async function employerOf(supabase: Supabase, tenantId: string): Promise<Employer> {
  const [{ data: tenant }, { count }] = await Promise.all([
    supabase.from("tenants").select("person_type").eq("id", tenantId).maybeSingle(),
    supabase
      .from("workers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .neq("contract_type", "prestacion_servicios"),
  ]);
  return { personType: tenant?.person_type === "natural" ? "natural" : "juridica", workerCount: count ?? 0 };
}

async function leavesByWorker(supabase: Supabase, workerIds: string[]) {
  const { data } = workerIds.length
    ? await supabase.from("worker_leaves").select("worker_id, type, start_date, end_date").in("worker_id", workerIds)
    : { data: [] };
  const map = new Map<string, { type: string; start_date: string; end_date: string }[]>();
  for (const l of data ?? []) map.set(l.worker_id, [...(map.get(l.worker_id) ?? []), l]);
  return map;
}

// ---------- Licencias ----------

export async function createLeave(_prev: PayrollState, formData: FormData): Promise<PayrollState> {
  const parsed = leaveSchema.safeParse({
    worker_id: formData.get("worker_id"),
    type: formData.get("type"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    note: formData.get("note")?.toString(),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const active = await tenantOrError();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const { error } = await supabase.from("worker_leaves").insert({
    tenant_id: active.tenantId,
    worker_id: parsed.data.worker_id,
    type: parsed.data.type,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    note: parsed.data.note,
  });
  if (error) {
    console.error("createLeave:", error.code);
    return { ok: false, error: "No se pudo guardar la licencia. Intenta de nuevo." };
  }
  revalidatePayroll();
  return { ok: true };
}

export async function deleteLeave(formData: FormData): Promise<void> {
  const parsed = z.uuid().safeParse(formData.get("id"));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("worker_leaves").delete().eq("id", parsed.data);
  revalidatePayroll();
}

// ---------- Datos DIAN ----------

export async function saveDianSettings(_prev: PayrollState, formData: FormData): Promise<PayrollState> {
  const get = (k: string) => formData.get(k)?.toString();
  const parsed = dianSettingsSchema.safeParse({
    nit: get("nit"),
    dv: get("dv"),
    company_name: get("company_name"),
    software_id: get("software_id"),
    software_pin: get("software_pin"),
    test_set_id: get("test_set_id"),
    address: get("address"),
    city: get("city"),
    department: get("department"),
    email: get("email"),
    phone: get("phone"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const active = await tenantOrError();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const d = parsed.data;
  const { error } = await supabase.from("dian_settings").upsert({
    tenant_id: active.tenantId,
    nit: d.nit,
    dv: d.dv,
    company_name: d.company_name,
    software_id: d.software_id,
    software_pin: d.software_pin,
    test_set_id: d.test_set_id,
    address: d.address,
    city: d.city,
    department: d.department,
    email: d.email,
    phone: d.phone,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("saveDianSettings:", error.code);
    return { ok: false, error: "No se pudieron guardar los datos DIAN. Intenta de nuevo." };
  }
  revalidatePayroll();
  return { ok: true };
}

// ---------- Períodos ----------

/**
 * S21-05: crea el período y liquida a todos los trabajadores activos con días en el período
 * (salvo prestación de servicios, que no es nómina). Días por defecto: los del contrato dentro
 * del período menos licencias; por horas quedan en 0 horas hasta que se registren.
 */
export async function createPayrollPeriod(_prev: PayrollState, formData: FormData): Promise<PayrollState> {
  const parsed = periodSchema.safeParse({
    period_start: formData.get("period_start"),
    period_end: formData.get("period_end"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const period = { start: parsed.data.period_start, end: parsed.data.period_end };

  const active = await tenantOrError();
  if (!active) return { ok: false, error: "No se pudo determinar la empresa activa." };

  const supabase = await createClient();
  const { data: workers } = await supabase
    .from("workers")
    .select(WORKER_COLUMNS)
    .eq("active", true)
    .neq("contract_type", "prestacion_servicios");
  const [leaves, employer] = await Promise.all([
    leavesByWorker(supabase, (workers ?? []).map((w) => w.id)),
    employerOf(supabase, active.tenantId),
  ]);

  const settlements = [];
  for (const w of workers ?? []) {
    const workerLeaves = leaves.get(w.id) ?? [];
    const leaveDays = leavesInPeriod(workerLeaves, period.start, period.end).reduce((s, l) => s + l.daysInPeriod, 0);
    const days = defaultDaysWorked(period.start, period.end, w.hire_date, w.end_date, leaveDays);
    if (w.worker_type !== "por_horas" && days === 0 && leaveDays === 0) continue;
    const novelties: SettlementNovelties = {
      days_worked: w.worker_type === "por_horas" ? 0 : days,
      extra_diurna: 0,
      extra_nocturna: 0,
      recargo_nocturno: 0,
      horas_dominical_festivo: 0,
      hours_worked: 0,
      weekly_hours: 0,
    };
    settlements.push({ worker_id: w.id, ...settlementValues(active.tenantId, w, novelties, workerLeaves, period, employer) });
  }

  const { data: periodId, error } = await supabase.rpc("create_payroll_period", {
    p_tenant_id: active.tenantId,
    p_start: period.start,
    p_end: period.end,
    p_settlements: JSON.parse(JSON.stringify(settlements)),
  });
  if (error || !periodId) {
    console.error("createPayrollPeriod:", error?.code, error?.message);
    if (error?.code === "23505") return { ok: false, error: "Ya existe un período con esas fechas." };
    return { ok: false, error: "No se pudo crear el período. Intenta de nuevo." };
  }
  revalidatePayroll();
  redirect(`/equipo/nomina/${periodId}`);
}

async function loadPeriod(supabase: Supabase, periodId: string) {
  const { data } = await supabase
    .from("payroll_periods")
    .select("id, tenant_id, period_start, period_end, status")
    .eq("id", periodId)
    .maybeSingle();
  return data;
}

const settlementUpdateSchema = noveltiesSchema.extend({ id: z.uuid() });

/** Ajusta las novedades de un trabajador y lo vuelve a liquidar (período abierto). */
export async function updateSettlement(_prev: PayrollState, formData: FormData): Promise<PayrollState> {
  const raw = Object.fromEntries(
    ["id", ...Object.keys(noveltiesSchema.shape)].map((k) => [k, formData.get(k)?.toString() || undefined]),
  );
  const parsed = settlementUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, ...novelties } = parsed.data;

  const supabase = await createClient();
  const { data: s } = await supabase
    .from("payroll_settlements")
    .select(`tenant_id, period_id, dian_status, workers(${WORKER_COLUMNS})`)
    .eq("id", id)
    .maybeSingle();
  if (!s || !s.workers) return { ok: false, error: "No se encontró la liquidación." };
  if (s.dian_status === "generated") return { ok: false, error: "Ya se generó la nómina electrónica de este trabajador." };
  const period = await loadPeriod(supabase, s.period_id);
  if (!period || period.status !== "draft") return { ok: false, error: "El período está cerrado." };

  const [leavesMap, employer] = await Promise.all([
    leavesByWorker(supabase, [s.workers.id]),
    employerOf(supabase, s.tenant_id),
  ]);
  const values = settlementValues(
    s.tenant_id,
    s.workers,
    novelties,
    leavesMap.get(s.workers.id) ?? [],
    { start: period.period_start, end: period.period_end },
    employer,
  );
  const { error } = await supabase
    .from("payroll_settlements")
    .update({ ...values, result: JSON.parse(JSON.stringify(values.result)) })
    .eq("id", id);
  if (error) {
    console.error("updateSettlement:", error.code);
    return { ok: false, error: "No se pudo recalcular. Intenta de nuevo." };
  }
  revalidatePayroll();
  return { ok: true };
}

/** Vuelve a liquidar todo el período (p. ej. después de registrar una licencia). */
export async function recalculatePeriod(formData: FormData): Promise<void> {
  const periodId = z.uuid().safeParse(formData.get("period_id"));
  if (!periodId.success) return;
  const supabase = await createClient();
  const period = await loadPeriod(supabase, periodId.data);
  if (!period || period.status !== "draft") return;

  const { data: rows } = await supabase
    .from("payroll_settlements")
    .select(
      `id, worker_id, dian_status, days_worked, extra_diurna, extra_nocturna, recargo_nocturno, horas_dominical_festivo, hours_worked, weekly_hours, workers(${WORKER_COLUMNS})`,
    )
    .eq("period_id", period.id)
    .eq("dian_status", "pending");
  const [leaves, employer] = await Promise.all([
    leavesByWorker(supabase, (rows ?? []).map((r) => r.worker_id)),
    employerOf(supabase, period.tenant_id),
  ]);

  const updates = (rows ?? [])
    .filter((r) => r.workers)
    .map((r) => {
      const values = settlementValues(
        period.tenant_id,
        r.workers!,
        {
          days_worked: r.days_worked,
          extra_diurna: r.extra_diurna,
          extra_nocturna: r.extra_nocturna,
          recargo_nocturno: r.recargo_nocturno,
          horas_dominical_festivo: r.horas_dominical_festivo,
          hours_worked: r.hours_worked,
          weekly_hours: r.weekly_hours,
        },
        leaves.get(r.worker_id) ?? [],
        { start: period.period_start, end: period.period_end },
        employer,
      );
      return {
        id: r.id,
        tenant_id: period.tenant_id,
        period_id: period.id,
        worker_id: r.worker_id,
        ...values,
        result: JSON.parse(JSON.stringify(values.result)),
      };
    });
  // Un solo upsert (una sentencia, atómica) en vez de una actualización por trabajador.
  if (updates.length) await supabase.from("payroll_settlements").upsert(updates);
  revalidatePayroll();
}

export async function closePeriod(formData: FormData): Promise<void> {
  const parsed = z.uuid().safeParse(formData.get("period_id"));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase
    .from("payroll_periods")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("status", "draft");
  revalidatePayroll();
}

/** Borra un período abierto sin nómina electrónica generada (sus liquidaciones se van con él). */
export async function deletePeriod(formData: FormData): Promise<void> {
  const parsed = z.uuid().safeParse(formData.get("period_id"));
  if (!parsed.success) return;
  const supabase = await createClient();
  const { count } = await supabase
    .from("payroll_settlements")
    .select("id", { count: "exact", head: true })
    .eq("period_id", parsed.data)
    .eq("dian_status", "generated");
  if (count) return;
  await supabase.from("payroll_periods").delete().eq("id", parsed.data).eq("status", "draft");
  revalidatePayroll();
  redirect("/equipo/nomina");
}

// ---------- Nómina electrónica DIAN ----------

/** Genera el XML de nómina electrónica (con CUNE y consecutivo) de un trabajador. */
export async function generateDian(_prev: PayrollState, formData: FormData): Promise<PayrollState> {
  const parsedId = z.uuid().safeParse(formData.get("settlement_id"));
  if (!parsedId.success) return { ok: false, error: "Liquidación inválida." };

  const supabase = await createClient();
  const { data: s } = await supabase
    .from("payroll_settlements")
    .select(`id, tenant_id, dian_status, result, workers(${WORKER_COLUMNS})`)
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!s || !s.workers) return { ok: false, error: "No se encontró la liquidación." };
  if (s.dian_status === "generated") return { ok: false, error: "Ya se generó." };
  const result = s.result as unknown as ColombiaPayrollResult & { error?: string };
  if (result.error || !result.netPay) return { ok: false, error: "Primero liquida bien a este trabajador." };

  const extra = dianEmployeeExtra(s.workers);
  if (!extra.ok) return extra;

  const { data: settings } = await supabase
    .from("dian_settings")
    .select("*")
    .eq("tenant_id", s.tenant_id)
    .maybeSingle();
  if (!settings) return { ok: false, error: "Primero completa los datos DIAN de la empresa (botón Datos DIAN)." };

  const { data: consecutive, error: counterError } = await supabase.rpc("next_dian_consecutive", {
    p_tenant_id: s.tenant_id,
  });
  if (counterError || !consecutive) {
    console.error("generateDian counter:", counterError?.code);
    return { ok: false, error: "No se pudo obtener el consecutivo. Intenta de nuevo." };
  }

  const xml = await DianNominaXmlService.generateDSPNE(
    result,
    {
      nit: settings.nit,
      dv: settings.dv,
      companyName: settings.company_name,
      softwareId: settings.software_id,
      pinSoftware: settings.software_pin,
      testSetId: settings.test_set_id ?? undefined,
      address: settings.address ?? undefined,
      city: settings.city ?? undefined,
      department: settings.department ?? undefined,
      email: settings.email ?? undefined,
      phone: settings.phone ?? undefined,
    },
    extra.extra,
    consecutive,
  );

  const { error } = await supabase
    .from("payroll_settlements")
    .update({
      dian_status: "generated",
      dian_consecutive: consecutive,
      dian_cune: xml.cune,
      dian_xml: xml.xmlContent,
      dian_generated_at: new Date().toISOString(),
    })
    .eq("id", s.id);
  if (error) {
    console.error("generateDian:", error.code);
    return { ok: false, error: "No se pudo guardar la nómina electrónica. Intenta de nuevo." };
  }
  revalidatePayroll();
  return { ok: true };
}
