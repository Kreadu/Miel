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

function mockSupabase(rpcResult: { data?: string; error: { code?: string; message: string } | null }) {
  return { rpc: vi.fn(async () => rpcResult) };
}

function mockUpdateSupabase(updateResult: { error: { code?: string; message: string } | null }) {
  const eq = vi.fn(async () => updateResult);
  const update = vi.fn(() => ({ eq }));
  return { from: vi.fn(() => ({ update })), _update: update, _eq: eq };
}

const clientState: { current: ReturnType<typeof mockSupabase> } = {
  current: mockSupabase({ data: "product-1", error: null }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => clientState.current),
}));

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const baseFields = {
  sku: "SKU-001",
  name: "Miel de abeja 500g",
  unit: "unidad",
  kind: "resale",
  cost: "10000",
  price: "18000",
  tax_rate: "19",
  min_stock: "5",
};

describe("createProduct — alta con stock inicial (S13-01)", () => {
  it("invoca create_product_with_stock con warehouse_id/qty null cuando no hay stock inicial", async () => {
    clientState.current = mockSupabase({ data: "product-1", error: null });
    const { createProduct } = await import("./products");

    const result = await createProduct(null, formData(baseFields));

    expect(clientState.current.rpc).toHaveBeenCalledWith("create_product_with_stock", {
      p_tenant_id: "tenant-a",
      p_sku: "SKU-001",
      p_name: "Miel de abeja 500g",
      p_description: undefined,
      p_unit: "unidad",
      p_kind: "resale",
      p_cost: 10000,
      p_price: 18000,
      p_tax_rate: 19,
      p_min_stock: 5,
      p_warehouse_id: undefined,
      p_qty: undefined,
    });
    expect(result).toMatchObject({ ok: true });
  });

  it("invoca la RPC con warehouse_id/qty cuando se completa el stock inicial", async () => {
    clientState.current = mockSupabase({ data: "product-1", error: null });
    const { createProduct } = await import("./products");

    const warehouseId = "123e4567-e89b-12d3-a456-426614174001";
    await createProduct(
      null,
      formData({ ...baseFields, warehouse_id: warehouseId, initial_qty: "10" }),
    );

    expect(clientState.current.rpc).toHaveBeenCalledWith(
      "create_product_with_stock",
      expect.objectContaining({ p_warehouse_id: warehouseId, p_qty: 10 }),
    );
  });

  it("warehouse_required mapea a mensaje legible", async () => {
    clientState.current = mockSupabase({ error: { code: "P0001", message: "warehouse_required" } });
    const { createProduct } = await import("./products");

    const result = await createProduct(null, formData(baseFields));

    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).not.toContain("warehouse_required");
  });

  it("sin tenant activo no invoca la RPC", async () => {
    const { getActiveTenant } = await import("@/lib/tenant/server");
    vi.mocked(getActiveTenant).mockResolvedValueOnce({ active: null, memberships: [] });
    clientState.current = mockSupabase({ data: "product-1", error: null });
    const { createProduct } = await import("./products");

    const result = await createProduct(null, formData(baseFields));

    expect(clientState.current.rpc).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false });
  });
});

describe("updateProduct — edición (S13-02)", () => {
  const productId = "123e4567-e89b-12d3-a456-426614174002";

  it("actualiza el producto por id con columnas explícitas", async () => {
    const mock = mockUpdateSupabase({ error: null });
    clientState.current = mock as unknown as ReturnType<typeof mockSupabase>;
    const { updateProduct } = await import("./products");

    const result = await updateProduct(null, formData({ ...baseFields, id: productId }));

    expect(mock._update).toHaveBeenCalledWith({
      sku: "SKU-001",
      name: "Miel de abeja 500g",
      description: null,
      unit: "unidad",
      kind: "resale",
      cost: 10000,
      price: 18000,
      tax_rate: 19,
      min_stock: 5,
    });
    expect(mock._eq).toHaveBeenCalledWith("id", productId);
    expect(result).toMatchObject({ ok: true });
  });

  it("SKU duplicado (23505) mapea a mensaje legible", async () => {
    const mock = mockUpdateSupabase({ error: { code: "23505", message: "duplicate" } });
    clientState.current = mock as unknown as ReturnType<typeof mockSupabase>;
    const { updateProduct } = await import("./products");

    const result = await updateProduct(null, formData({ ...baseFields, id: productId }));

    expect(result).toMatchObject({ ok: false, error: "Ya existe un producto con ese SKU." });
  });

  it("sin id válido no llega a tocar la base de datos", async () => {
    const mock = mockUpdateSupabase({ error: null });
    clientState.current = mock as unknown as ReturnType<typeof mockSupabase>;
    const { updateProduct } = await import("./products");

    const result = await updateProduct(null, formData(baseFields));

    expect(mock._update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false });
  });
});

describe("toggleProductActive — archivar/reactivar (S13-02)", () => {
  const productId = "123e4567-e89b-12d3-a456-426614174003";

  it("actualiza active=false al archivar", async () => {
    const mock = mockUpdateSupabase({ error: null });
    clientState.current = mock as unknown as ReturnType<typeof mockSupabase>;
    const { toggleProductActive } = await import("./products");

    await toggleProductActive(formData({ id: productId, active: "false" }));

    expect(mock._update).toHaveBeenCalledWith({ active: false });
    expect(mock._eq).toHaveBeenCalledWith("id", productId);
  });

  it("actualiza active=true al reactivar", async () => {
    const mock = mockUpdateSupabase({ error: null });
    clientState.current = mock as unknown as ReturnType<typeof mockSupabase>;
    const { toggleProductActive } = await import("./products");

    await toggleProductActive(formData({ id: productId, active: "true" }));

    expect(mock._update).toHaveBeenCalledWith({ active: true });
  });
});
