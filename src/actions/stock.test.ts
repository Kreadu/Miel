import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function mockSupabase(rpcResult: { error: { code?: string; message: string } | null }) {
  return { rpc: vi.fn(async () => rpcResult) };
}

const clientState: { current: ReturnType<typeof mockSupabase> } = {
  current: mockSupabase({ error: null }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => clientState.current),
}));

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const base = {
  product_id: "123e4567-e89b-12d3-a456-426614174000",
  warehouse_id: "123e4567-e89b-12d3-a456-426614174001",
  unit_cost: "0",
};

describe("registerManualMovement — out/adjust (S13-03)", () => {
  it("reenvía kind=out a la RPC", async () => {
    clientState.current = mockSupabase({ error: null });
    const { registerManualMovement } = await import("./stock");

    await registerManualMovement(null, formData({ ...base, kind: "out", qty: "5" }));

    expect(clientState.current.rpc).toHaveBeenCalledWith(
      "register_movement",
      expect.objectContaining({ p_kind: "out", p_qty: 5 }),
    );
  });

  it("reenvía kind=adjust con qty negativa a la RPC", async () => {
    clientState.current = mockSupabase({ error: null });
    const { registerManualMovement } = await import("./stock");

    await registerManualMovement(null, formData({ ...base, kind: "adjust", qty: "-3" }));

    expect(clientState.current.rpc).toHaveBeenCalledWith(
      "register_movement",
      expect.objectContaining({ p_kind: "adjust", p_qty: -3 }),
    );
  });

  it("stock_insufficient en un ajuste mapea al mensaje genérico de bodega", async () => {
    clientState.current = mockSupabase({ error: { code: "P0001", message: "stock_insufficient" } });
    const { registerManualMovement } = await import("./stock");

    const result = await registerManualMovement(null, formData({ ...base, kind: "adjust", qty: "-3" }));

    expect(result).toMatchObject({ ok: false, error: "No hay stock suficiente en esa bodega." });
  });
});
