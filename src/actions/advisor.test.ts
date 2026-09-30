import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildIncomeStatement } from "@/lib/finance/income-statement";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "en") }));
const tenant = { current: { tenantId: "t-1", role: "owner" } as { tenantId: string; role: string } };
vi.mock("@/lib/tenant/server", () => ({ getActiveTenant: vi.fn(async () => ({ active: tenant.current })) }));

const askModel = vi.fn();
const configured = { current: true };
vi.mock("@/lib/ai/advisor", () => ({
  askModel: (...args: unknown[]) => askModel(...args),
  isAdvisorConfigured: () => configured.current,
}));

const s = buildIncomeStatement({ income: 1000, cogs: 600, payroll: [], expenses: [], lines: {}, incomeTaxRate: 35 });
vi.mock("@/lib/finance/load", () => ({
  loadFinance: vi.fn(async () => ({
    monthly: [{ month: "2026-09", statement: s }],
    total: s,
    balances: { receivable: 0, payable: 0, inventory: 0 },
    health: { summary: { kind: "healthy", count: 0 }, indicators: [] },
    fiscal: { personType: "juridica", incomeTaxRate: 35 },
  })),
  rangeBounds: () => ({ start: "2026-09-01T00:00:00-05:00", end: "2026-10-01T00:00:00-05:00" }),
}));

const todayCount = { current: 0 };
const insert = vi.fn<(row: unknown) => Promise<{ error: null }>>(async () => ({ error: null }));
const client = {
  from: vi.fn((t: string) => {
    if (t === "advisor_questions")
      return {
        select: () => ({ eq: () => ({ gte: async () => ({ count: todayCount.current }) }) }),
        insert,
      };
    // sale_items del rango
    const chain = {
      eq: () => chain,
      in: () => chain,
      gte: () => chain,
      lt: () => chain,
      limit: async () => ({
        data: [{ qty: 3, unit_price: 100, discount: 0, unit_cost: 50, products: { name: "Miel 500 g" } }],
        error: null,
      }),
    };
    return { select: () => chain };
  }),
};
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => client) }));

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}
const ask = formData({ question: "¿Cómo subo el margen?", desde: "2026-09", hasta: "2026-09" });

describe("askAdvisor (S22-03)", () => {
  beforeEach(() => {
    askModel.mockReset();
    insert.mockClear();
    tenant.current = { tenantId: "t-1", role: "owner" };
    configured.current = true;
    todayCount.current = 0;
  });

  it("un operativo no puede preguntar (no llama a la IA)", async () => {
    tenant.current = { tenantId: "t-1", role: "member" };
    const { askAdvisor } = await import("./advisor");
    expect(await askAdvisor(null, ask)).toMatchObject({ ok: false });
    expect(askModel).not.toHaveBeenCalled();
  });

  it("sin llave de IA: mensaje claro, sin llamar", async () => {
    configured.current = false;
    const { askAdvisor } = await import("./advisor");
    expect(await askAdvisor(null, ask)).toEqual({ ok: false, error: "advisor.errors.notConfigured" });
    expect(askModel).not.toHaveBeenCalled();
  });

  it("límite diario alcanzado: no llama a la IA", async () => {
    todayCount.current = 20;
    const { askAdvisor } = await import("./advisor");
    expect(await askAdvisor(null, ask)).toMatchObject({ ok: false });
    expect(askModel).not.toHaveBeenCalled();
  });

  it("arma el contexto en el servidor (con productos), guarda y devuelve la respuesta", async () => {
    askModel.mockResolvedValue({ ok: true, text: "Sube el precio de Miel 500 g." });
    const { askAdvisor } = await import("./advisor");
    expect(await askAdvisor(null, ask)).toEqual({ ok: true, answer: "Sube el precio de Miel 500 g." });
    const [context, question, locale] = askModel.mock.calls[0] as [string, string, string];
    expect(locale).toBe("en");
    expect(context).toContain("Miel 500 g");
    expect(question).toBe("¿Cómo subo el margen?");
    expect(insert).toHaveBeenCalledWith({
      tenant_id: "t-1",
      question: "¿Cómo subo el margen?",
      answer: "Sube el precio de Miel 500 g.",
      range_from: "2026-09",
      range_to: "2026-09",
    });
  });

  it("si la IA falla, error genérico y no guarda", async () => {
    askModel.mockResolvedValue({ ok: false, reason: "failed" });
    const { askAdvisor } = await import("./advisor");
    expect(await askAdvisor(null, ask)).toMatchObject({ ok: false });
    expect(insert).not.toHaveBeenCalled();
  });
});
