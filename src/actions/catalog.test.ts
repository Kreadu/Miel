import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/tenant/server", () => ({
  getActiveTenant: vi.fn(async () => ({ active: { tenantId: "t-1" } })),
}));

type InsertResult = { data: { id: string; name: string } | null; error: { code: string } | null };

function mockSupabase(result: InsertResult) {
  const single = vi.fn(async () => result);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  return { from: vi.fn(() => ({ insert })), insert };
}

const clientState: { current: ReturnType<typeof mockSupabase> } = {
  current: mockSupabase({ data: null, error: null }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => clientState.current),
}));

describe("createCategory (S19-16)", () => {
  it("devuelve la categoría creada para seleccionarla", async () => {
    clientState.current = mockSupabase({ data: { id: "c-1", name: "Endulzantes" }, error: null });
    const { createCategory } = await import("./catalog");

    const result = await createCategory("  Endulzantes ", "productos");

    expect(result).toEqual({ ok: true, category: { id: "c-1", name: "Endulzantes" } });
    expect(clientState.current.insert).toHaveBeenCalledWith({
      tenant_id: "t-1",
      inventory: "productos",
      name: "Endulzantes",
    });
  });

  it("nombre duplicado (23505) → mensaje claro", async () => {
    clientState.current = mockSupabase({ data: null, error: { code: "23505" } });
    const { createCategory } = await import("./catalog");

    expect(await createCategory("Endulzantes", "productos")).toEqual({
      ok: false,
      error: "catalog.errors.duplicateCategory",
    });
  });

  it("S19-28: la categoría se crea en el inventario indicado", async () => {
    clientState.current = mockSupabase({ data: { id: "c-2", name: "Camionetas" }, error: null });
    const { createCategory } = await import("./catalog");

    await createCategory("Camionetas", "vehiculos");

    expect(clientState.current.insert).toHaveBeenCalledWith({
      tenant_id: "t-1",
      inventory: "vehiculos",
      name: "Camionetas",
    });
  });

  it("S19-28: inventario desconocido → error sin tocar la BD", async () => {
    clientState.current = mockSupabase({ data: null, error: null });
    const { createCategory } = await import("./catalog");

    expect((await createCategory("X", "juguetes")).ok).toBe(false);
    expect(clientState.current.from).not.toHaveBeenCalled();
  });

  it("nombre vacío → error de validación sin tocar la BD", async () => {
    clientState.current = mockSupabase({ data: null, error: null });
    const { createCategory } = await import("./catalog");

    const result = await createCategory("   ", "productos");

    expect(result.ok).toBe(false);
    expect(clientState.current.from).not.toHaveBeenCalled();
  });
});

function mockMutation(result: { data: { id: string }[] | null; error: { code: string } | null }) {
  const select = vi.fn(async () => result);
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const del = vi.fn(() => ({ eq }));
  return { from: vi.fn(() => ({ update, delete: del })), update, del };
}

describe("renameCategory / deleteCategory (S19-21)", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  it("renombra con el nombre recortado", async () => {
    const mock = mockMutation({ data: [{ id }], error: null });
    clientState.current = mock as never;
    const { renameCategory } = await import("./catalog");

    expect(await renameCategory(id, "  Dulces ")).toEqual({ ok: true });
    expect(mock.update).toHaveBeenCalledWith({ name: "Dulces" });
  });

  it("renombrar a un nombre existente (23505) → mensaje claro", async () => {
    clientState.current = mockMutation({ data: null, error: { code: "23505" } }) as never;
    const { renameCategory } = await import("./catalog");

    expect(await renameCategory(id, "Dulces")).toEqual({
      ok: false,
      error: "catalog.errors.duplicateCategory",
    });
  });

  it("0 filas afectadas (sin permiso o ajena) → error, no éxito falso", async () => {
    clientState.current = mockMutation({ data: [], error: null }) as never;
    const { deleteCategory } = await import("./catalog");

    expect((await deleteCategory(id)).ok).toBe(false);
  });

  it("elimina", async () => {
    const mock = mockMutation({ data: [{ id }], error: null });
    clientState.current = mock as never;
    const { deleteCategory } = await import("./catalog");

    expect(await deleteCategory(id)).toEqual({ ok: true });
    expect(mock.del).toHaveBeenCalled();
  });

  it("id inválido → error sin tocar la BD", async () => {
    const mock = mockMutation({ data: [], error: null });
    clientState.current = mock as never;
    const { deleteCategory } = await import("./catalog");

    expect((await deleteCategory("no-uuid")).ok).toBe(false);
    expect(mock.from).not.toHaveBeenCalled();
  });
});
