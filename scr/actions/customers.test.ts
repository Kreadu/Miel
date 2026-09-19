import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const activeTenant = {
  tenantId: "tenant-a",
  tenantName: "Tenant A",
  role: "member" as const,
};

vi.mock("@/lib/tenant/server", () => ({
  getActiveTenant: vi.fn(async () => ({ active: activeTenant, memberships: [] })),
}));

function mockInsertSupabase(singleResult: {
  data: { id: string; name: string } | null;
  error: { code?: string; message: string } | null;
}) {
  const single = vi.fn(async () => singleResult);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  return { from: vi.fn(() => ({ insert })), _insert: insert, _select: select, _single: single };
}

const clientState: { current: ReturnType<typeof mockInsertSupabase> } = {
  current: mockInsertSupabase({ data: { id: "c1", name: "Ana" }, error: null }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => clientState.current),
}));

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const validFields = { name: "Ana", doc_type: "cc" };

describe("createCustomer", () => {
  it("inserta con columnas explícitas y tenant_id resuelto en servidor (member incluido, ADR-033)", async () => {
    const { createCustomer } = await import("./customers");
    const client = mockInsertSupabase({ data: { id: "c1", name: "Ana" }, error: null });
    clientState.current = client;

    const result = await createCustomer(null, formData(validFields));

    expect(result).toEqual({ ok: true, customer: { id: "c1", name: "Ana" } });
    expect(client.from).toHaveBeenCalledWith("customers");
    expect(client._insert).toHaveBeenCalledWith({
      tenant_id: activeTenant.tenantId,
      name: "Ana",
      doc_type: "cc",
      doc_number: null,
      email: null,
      phone: null,
      address: null,
      note: null,
    });
  });

  it("mapea 23505 a mensaje de documento duplicado sin exponer el código interno", async () => {
    const { createCustomer } = await import("./customers");
    const client = mockInsertSupabase({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    clientState.current = client;

    const result = await createCustomer(null, formData(validFields));

    expect(result).toEqual({
      ok: false,
      error: "Ya existe un cliente con ese tipo y número de documento.",
    });
  });

  it("rechaza nombre vacío antes de tocar la BD", async () => {
    const { createCustomer } = await import("./customers");
    const client = mockInsertSupabase({ data: { id: "c1", name: "" }, error: null });
    clientState.current = client;

    const result = await createCustomer(null, formData({ name: "", doc_type: "cc" }));

    expect(result).toEqual({ ok: false, error: "El nombre es obligatorio" });
    expect(client._insert).not.toHaveBeenCalled();
  });
});
