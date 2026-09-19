import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const activeTenant = {
  tenantId: "tenant-a",
  tenantName: "Tenant A",
  role: "owner" as const,
};

vi.mock("@/lib/tenant/server", () => ({
  getActiveTenant: vi.fn(async () => ({ active: activeTenant, memberships: [] })),
}));

function mockInsertSupabase(insertResult: { error: { code?: string; message: string } | null }) {
  const insert = vi.fn(async () => insertResult);
  return { from: vi.fn(() => ({ insert })), _insert: insert };
}

function mockDeleteSupabase() {
  const eq2 = vi.fn(async () => ({ error: null }));
  const eq1 = vi.fn(() => ({ eq: eq2 }));
  const del = vi.fn(() => ({ eq: eq1 }));
  return { from: vi.fn(() => ({ delete: del })), _delete: del, _eq1: eq1, _eq2: eq2 };
}

const clientState: { current: ReturnType<typeof mockInsertSupabase> | ReturnType<typeof mockDeleteSupabase> } = {
  current: mockInsertSupabase({ error: null }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => clientState.current),
}));

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const validFields = {
  supplier_id: "11111111-1111-4111-8111-111111111111",
  product_id: "22222222-2222-4222-8222-222222222222",
};

describe("linkSupplierProduct", () => {
  it("inserta con columnas explícitas (tenant_id resuelto en servidor)", async () => {
    const { linkSupplierProduct } = await import("./supplier-products");
    const client = mockInsertSupabase({ error: null });
    clientState.current = client;

    const result = await linkSupplierProduct(null, formData(validFields));

    expect(result).toEqual({ ok: true });
    expect(client.from).toHaveBeenCalledWith("supplier_products");
    expect(client._insert).toHaveBeenCalledWith({
      tenant_id: activeTenant.tenantId,
      supplier_id: validFields.supplier_id,
      product_id: validFields.product_id,
    });
  });

  it("rechaza un product_id inválido antes de tocar la BD", async () => {
    const { linkSupplierProduct } = await import("./supplier-products");
    const client = mockInsertSupabase({ error: null });
    clientState.current = client;

    const result = await linkSupplierProduct(
      null,
      formData({ ...validFields, product_id: "no-es-uuid" }),
    );

    expect(result).toEqual({ ok: false, error: "Producto inválido" });
    expect(client._insert).not.toHaveBeenCalled();
  });

  it("mapea 23505 a mensaje de duplicado sin exponer el código interno", async () => {
    const { linkSupplierProduct } = await import("./supplier-products");
    const client = mockInsertSupabase({ error: { code: "23505", message: "duplicate key" } });
    clientState.current = client;

    const result = await linkSupplierProduct(null, formData(validFields));

    expect(result).toEqual({
      ok: false,
      error: "Ese producto ya estaba asociado a este proveedor.",
    });
  });
});

describe("unlinkSupplierProduct", () => {
  it("borra por supplier_id + product_id", async () => {
    const { unlinkSupplierProduct } = await import("./supplier-products");
    const client = mockDeleteSupabase();
    clientState.current = client;

    await unlinkSupplierProduct(formData(validFields));

    expect(client.from).toHaveBeenCalledWith("supplier_products");
    expect(client._eq1).toHaveBeenCalledWith("supplier_id", validFields.supplier_id);
    expect(client._eq2).toHaveBeenCalledWith("product_id", validFields.product_id);
  });
});
