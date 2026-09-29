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

type DbError = { code?: string; message: string } | null;

function mockInsertSupabase(error: DbError) {
  const insert = vi.fn(async () => ({ error }));
  return { from: vi.fn(() => ({ insert })), _insert: insert };
}

function mockUpdateSupabase(error: DbError) {
  const eq = vi.fn(async () => ({ error }));
  const update = vi.fn(() => ({ eq }));
  return { from: vi.fn(() => ({ update })), _update: update, _eq: eq };
}

const clientState: { current: unknown } = { current: mockInsertSupabase(null) };

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
  discount_percent: "10",
  sales_channel: "in_store",
  category_id: "__none__",
};

const expectedColumns = {
  sku: "SKU-001",
  name: "Miel de abeja 500g",
  description: null,
  unit: "unidad",
  kind: "resale",
  cost: 10000,
  price: 18000,
  tax_rate: 19,
  min_stock: 5,
  discount_percent: 10,
  sales_channel: "in_store",
  category_id: null,
  inventory: "productos",
  plate: null,
  brand: null,
  model: null,
  color: null,
  serial_number: null,
  vehicle_year: null,
  purchase_date: null,
};

describe("createProduct — formulario único (S19-24)", () => {
  it("inserta con columnas explícitas del tenant activo", async () => {
    const mock = mockInsertSupabase(null);
    clientState.current = mock;
    const { createProduct } = await import("./products");

    const result = await createProduct(null, formData(baseFields));

    expect(mock._insert).toHaveBeenCalledWith({
      tenant_id: "tenant-a",
      ...expectedColumns,
      photo_url: null,
    });
    expect(result).toEqual({ ok: true });
  });

  it("SKU vacío → se genera solo", async () => {
    const mock = mockInsertSupabase(null);
    clientState.current = mock;
    const { createProduct } = await import("./products");

    await createProduct(null, formData({ ...baseFields, sku: "" }));

    const inserted = (mock._insert.mock.calls[0] as unknown as [{ sku: string }])[0];
    expect(inserted.sku).toMatch(/^PRD-[0-9A-F]{8}$/);
  });

  it("categoría elegida se guarda", async () => {
    const mock = mockInsertSupabase(null);
    clientState.current = mock;
    const { createProduct } = await import("./products");
    const categoryId = "11111111-1111-4111-8111-111111111111";

    await createProduct(null, formData({ ...baseFields, category_id: categoryId }));

    expect(mock._insert).toHaveBeenCalledWith(expect.objectContaining({ category_id: categoryId }));
  });

  it("S19-26: vehículo sin precio → kind other, precio 0 y datos del vehículo", async () => {
    const mock = mockInsertSupabase(null);
    clientState.current = mock;
    const { createProduct } = await import("./products");

    await createProduct(
      null,
      formData({
        name: "Camioneta",
        unit: "unidad",
        kind: "resale",
        cost: "50000000",
        min_stock: "0",
        inventory: "vehiculos",
        plate: "ABC123",
        brand: "Toyota",
        vehicle_year: "2022",
      }),
    );

    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        inventory: "vehiculos",
        kind: "other",
        price: 0,
        discount_percent: 0,
        plate: "ABC123",
        brand: "Toyota",
        vehicle_year: 2022,
      }),
    );
  });

  it("SKU duplicado (23505) → mensaje legible", async () => {
    clientState.current = mockInsertSupabase({ code: "23505", message: "duplicate" });
    const { createProduct } = await import("./products");

    expect(await createProduct(null, formData(baseFields))).toEqual({
      ok: false,
      error: "Ya existe un producto con ese SKU.",
    });
  });

  it("input inválido no toca la base de datos", async () => {
    const mock = mockInsertSupabase(null);
    clientState.current = mock;
    const { createProduct } = await import("./products");

    const result = await createProduct(null, formData({ ...baseFields, name: "" }));

    expect(mock._insert).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false });
  });
});

describe("updateProduct — formulario único (S19-24)", () => {
  const productId = "123e4567-e89b-12d3-a456-426614174002";

  it("actualiza por id con columnas explícitas; sin foto nueva no toca photo_url", async () => {
    const mock = mockUpdateSupabase(null);
    clientState.current = mock;
    const { updateProduct } = await import("./products");

    const result = await updateProduct(null, formData({ ...baseFields, id: productId }));

    expect(mock._update).toHaveBeenCalledWith(expectedColumns);
    expect(mock._eq).toHaveBeenCalledWith("id", productId);
    expect(result).toEqual({ ok: true });
  });

  it("SKU vacío al editar → se genera uno nuevo", async () => {
    const mock = mockUpdateSupabase(null);
    clientState.current = mock;
    const { updateProduct } = await import("./products");

    await updateProduct(null, formData({ ...baseFields, sku: "", id: productId }));

    const updated = (mock._update.mock.calls[0] as unknown as [{ sku: string }])[0];
    expect(updated.sku).toMatch(/^PRD-/);
  });

  it("sin id válido no toca la base de datos", async () => {
    const mock = mockUpdateSupabase(null);
    clientState.current = mock;
    const { updateProduct } = await import("./products");

    const result = await updateProduct(null, formData(baseFields));

    expect(mock._update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false });
  });
});

describe("toggleProductActive — archivar/reactivar (S13-02)", () => {
  const productId = "123e4567-e89b-12d3-a456-426614174003";

  it("actualiza active=false al archivar", async () => {
    const mock = mockUpdateSupabase(null);
    clientState.current = mock;
    const { toggleProductActive } = await import("./products");

    await toggleProductActive(formData({ id: productId, active: "false" }));

    expect(mock._update).toHaveBeenCalledWith({ active: false });
    expect(mock._eq).toHaveBeenCalledWith("id", productId);
  });

  it("actualiza active=true al reactivar", async () => {
    const mock = mockUpdateSupabase(null);
    clientState.current = mock;
    const { toggleProductActive } = await import("./products");

    await toggleProductActive(formData({ id: productId, active: "true" }));

    expect(mock._update).toHaveBeenCalledWith({ active: true });
  });
});
