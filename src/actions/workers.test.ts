import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant/server", () => ({
  getActiveTenant: vi.fn(async () => ({ active: { tenantId: "t-1" } })),
}));

type DbError = { code?: string; message: string } | null;
function mockSupabase(error: DbError) {
  const insert = vi.fn(async () => ({ error }));
  return { from: vi.fn(() => ({ insert })), insert };
}
const clientState: { current: ReturnType<typeof mockSupabase> } = { current: mockSupabase(null) };
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => clientState.current) }));

function formData(fields: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const value of Array.isArray(v) ? v : [v]) fd.append(k, value);
  }
  return fd;
}

describe("createWorkerCategory (S21-02)", () => {
  it("guarda los módulos marcados", async () => {
    clientState.current = mockSupabase(null);
    const { createWorkerCategory } = await import("./workers");

    const result = await createWorkerCategory(null, formData({ name: "Vendedor", modules: ["ventas", "inventario"] }));

    expect(result).toEqual({ ok: true });
    expect(clientState.current.insert).toHaveBeenCalledWith({
      tenant_id: "t-1",
      name: "Vendedor",
      modules: ["ventas", "inventario"],
    });
  });
});

describe("createWorker (S21-02)", () => {
  const base = { full_name: "Ana Pérez", doc_type: "cc", doc_number: "1010", salary: "1423500" };

  it("inserta con columnas explícitas; 'sin categoría' → null", async () => {
    clientState.current = mockSupabase(null);
    const { createWorker } = await import("./workers");

    await createWorker(null, formData({ ...base, category_id: "__none__", warehouse_id: "__none__" }));

    expect(clientState.current.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "t-1",
        full_name: "Ana Pérez",
        doc_number: "1010",
        salary: 1423500,
        category_id: null,
        warehouse_id: null,
      }),
    );
  });

  it("documento repetido → mensaje claro", async () => {
    clientState.current = mockSupabase({ code: "23505", message: "dup" });
    const { createWorker } = await import("./workers");

    expect(await createWorker(null, formData(base))).toEqual({
      ok: false,
      error: "Ya existe un trabajador con ese documento.",
    });
  });
});
