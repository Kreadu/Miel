import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant/server", () => ({
  getActiveTenant: vi.fn(async () => ({ active: { tenantId: "t-1" } })),
}));

type Result = { data: { id: string; name: string } | null; error: { code: string } | null };

function mockSupabase(result: Result) {
  const single = vi.fn(async () => result);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  return { from: vi.fn(() => ({ insert })), insert };
}

const clientState: { current: ReturnType<typeof mockSupabase> } = {
  current: mockSupabase({ data: null, error: null }),
};
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => clientState.current) }));

describe("quickCreateSupplier (S19-37: + proveedor desde la orden)", () => {
  it("crea y devuelve el proveedor para dejarlo elegido", async () => {
    clientState.current = mockSupabase({ data: { id: "s-1", name: "Apiario" }, error: null });
    const { quickCreateSupplier } = await import("./suppliers");

    const result = await quickCreateSupplier({ name: " Apiario ", nit: "900", phone: "" });

    expect(result).toEqual({ ok: true, supplier: { id: "s-1", name: "Apiario" } });
    expect(clientState.current.insert).toHaveBeenCalledWith({
      tenant_id: "t-1",
      name: "Apiario",
      nit: "900",
      email: null,
      phone: null,
      address: null,
    });
  });

  it("NIT repetido → mensaje claro", async () => {
    clientState.current = mockSupabase({ data: null, error: { code: "23505" } });
    const { quickCreateSupplier } = await import("./suppliers");

    expect(await quickCreateSupplier({ name: "X", nit: "900" })).toEqual({
      ok: false,
      error: "suppliers.errors.duplicateNit",
    });
  });

  it("sin nombre → error sin tocar la BD", async () => {
    clientState.current = mockSupabase({ data: null, error: null });
    const { quickCreateSupplier } = await import("./suppliers");

    expect((await quickCreateSupplier({ name: "  " })).ok).toBe(false);
    expect(clientState.current.from).not.toHaveBeenCalled();
  });
});
