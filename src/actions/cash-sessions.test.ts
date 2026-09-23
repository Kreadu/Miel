import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const activeTenant = {
  tenantId: "tenant-b",
  tenantName: "Tenant B",
  role: "member" as const,
};

vi.mock("@/lib/tenant/server", () => ({
  getActiveTenant: vi.fn(async () => ({ active: activeTenant, memberships: [] })),
}));

function mockSupabase(rpcResult: { error: { message: string } | null }) {
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

describe("openCashSession — tenant activo explícito (S12-04)", () => {
  it("invoca open_cash_session con p_tenant_id del tenant activo, no el primero de memberships", async () => {
    clientState.current = mockSupabase({ error: null });
    const { openCashSession } = await import("./cash-sessions");

    const result = await openCashSession(null, formData({ opening_amount: "500" }));

    expect(clientState.current.rpc).toHaveBeenCalledWith("open_cash_session", {
      p_opening_amount: 500,
      p_tenant_id: "tenant-b",
    });
    expect(result).toMatchObject({ ok: true });
  });

  it("sin tenant activo no invoca la RPC", async () => {
    clientState.current = mockSupabase({ error: null });
    const { getActiveTenant } = await import("@/lib/tenant/server");
    vi.mocked(getActiveTenant).mockResolvedValueOnce({ active: null, memberships: [] });
    const { openCashSession } = await import("./cash-sessions");

    const result = await openCashSession(null, formData({ opening_amount: "500" }));

    expect(clientState.current.rpc).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false });
  });

  it("permission_denied mapea a mensaje en español", async () => {
    clientState.current = mockSupabase({ error: { message: "permission_denied" } });
    const { openCashSession } = await import("./cash-sessions");

    const result = await openCashSession(null, formData({ opening_amount: "500" }));

    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).not.toContain("permission_denied");
  });
});
