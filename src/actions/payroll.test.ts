import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));
vi.mock("@/lib/tenant/server", () => ({
  getActiveTenant: vi.fn(async () => ({ active: { tenantId: "t-1" } })),
}));

const clientState: { current: unknown } = { current: null };
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => clientState.current) }));

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const baseWorker = {
  doc_type: "cc",
  contract_type: "indefinido",
  salary: 2_000_000,
  hourly_rate: 0,
  arl_risk_class: 1,
  worker_type: "planta",
  hire_date: null,
  end_date: null,
};

describe("createPayrollPeriod (S21-05)", () => {
  it("liquida a quien trabajó en el período y guarda todo en una sola llamada", async () => {
    const workers = [
      { ...baseWorker, id: "w-1", full_name: "Ana Pérez", doc_number: "1" },
      { ...baseWorker, id: "w-2", full_name: "Luis Gil", doc_number: "2", hire_date: "2026-10-05" },
    ];
    const rpc = vi.fn(async () => ({ data: "p-1", error: null }));
    const neq = vi.fn(async () => ({ data: workers }));
    const eq = vi.fn(() => ({ neq }));
    const inFn = vi.fn(async () => ({ data: [] }));
    clientState.current = {
      rpc,
      from: vi.fn((t: string) => {
        // S23-01: datos fiscales y conteo de trabajadores (exoneración 114-1).
        if (t === "tenants")
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { person_type: "juridica" } }) }) }) };
        if (t === "workers")
          return {
            select: (_cols: string, opts?: { count: string }) =>
              opts ? { eq: () => ({ eq: () => ({ neq: async () => ({ count: 2 }) }) }) } : { eq },
          };
        return { select: () => ({ in: inFn }) };
      }),
    };
    const { createPayrollPeriod } = await import("./payroll");

    await createPayrollPeriod(null, formData({ period_start: "2026-09-01", period_end: "2026-09-30" }));

    expect(rpc).toHaveBeenCalledTimes(1);
    const args = (rpc.mock.calls[0] as unknown as [string, { p_settlements: { worker_id: string; days_worked: number; net_pay: number }[] }])[1];
    expect(args.p_settlements.map((s) => s.worker_id)).toEqual(["w-1"]);
    expect(args.p_settlements[0].days_worked).toBe(30);
    expect(args.p_settlements[0].net_pay).toBeGreaterThan(0);
    expect(redirect).toHaveBeenCalledWith("/equipo/nomina/p-1");
  });

  it("rango invertido → error sin tocar la BD", async () => {
    const rpc = vi.fn();
    clientState.current = { rpc, from: vi.fn() };
    const { createPayrollPeriod } = await import("./payroll");

    const r = await createPayrollPeriod(null, formData({ period_start: "2026-09-30", period_end: "2026-09-01" }));

    expect(r).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("generateDian (S21-05)", () => {
  it("sin datos DIAN de la empresa → pide completarlos", async () => {
    const settlement = {
      id: "s-1",
      tenant_id: "t-1",
      dian_status: "pending",
      result: { netPay: 1_800_000 },
      workers: { ...baseWorker, id: "w-1", full_name: "Ana", doc_number: "1" },
    };
    const rpc = vi.fn();
    clientState.current = {
      rpc,
      from: vi.fn((t: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: t === "payroll_settlements" ? settlement : null }),
          }),
        }),
      })),
    };
    const { generateDian } = await import("./payroll");

    const r = await generateDian(null, formData({ settlement_id: "11111111-1111-4111-8111-111111111111" }));

    expect(r).toEqual({
      ok: false,
      error: "Primero completa los datos DIAN de la empresa (botón Datos DIAN).",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("createLeave (S21-05)", () => {
  it("guarda la licencia con columnas explícitas", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    clientState.current = { from: vi.fn(() => ({ insert })) };
    const { createLeave } = await import("./payroll");
    const W = "11111111-1111-4111-8111-111111111111";

    const r = await createLeave(
      null,
      formData({ worker_id: W, type: "PATERNITY_LEAVE", start_date: "2026-09-01", end_date: "2026-09-14" }),
    );

    expect(r).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith({
      tenant_id: "t-1",
      worker_id: W,
      type: "PATERNITY_LEAVE",
      start_date: "2026-09-01",
      end_date: "2026-09-14",
      note: null,
    });
  });
});
