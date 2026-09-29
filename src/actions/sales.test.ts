import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/tenant/server", () => ({
  getActiveTenant: vi.fn(async () => ({ active: { tenantId: "t-1" } })),
}));

const rpcResult: { current: { error: { code: string; message: string } | null } } = {
  current: { error: null },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: vi.fn(async () => rpcResult.current) })),
}));

describe("confirmSale — caja cerrada (S19-22)", () => {
  it("cash_session_required → pide abrir la caja", async () => {
    rpcResult.current = { error: { code: "P0001", message: "cash_session_required" } };
    const { confirmSale } = await import("./sales");

    expect(await confirmSale("s-1", "w-1")).toEqual({
      ok: false,
      error: "Abre tu caja para generar la boleta: el pedido tiene productos que se venden en tienda.",
    });
  });
});
