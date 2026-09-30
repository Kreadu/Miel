import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/activity/log", () => ({ logActivity: vi.fn() }));

const rpcResult: { current: { error: { code: string; message: string } | null } } = { current: { error: null } };
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: vi.fn(async () => rpcResult.current) })),
}));

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("registerCustomerPayment — caja (S18-08)", () => {
  it("efectivo sin caja abierta: pide abrirla", async () => {
    rpcResult.current = { error: { code: "P0001", message: "cash_session_required" } };
    const { registerCustomerPayment } = await import("./customer-payments");

    const result = await registerCustomerPayment(
      null,
      formData({
        customer_id: "44444444-4444-4444-8444-444444444444",
        sale_id: "55555555-5555-4555-8555-555555555555",
        amount: "100",
        method: "cash",
      }),
    );
    expect(result).toEqual({ ok: false, error: "payments.errors.cashSessionRequired" });
  });
});
