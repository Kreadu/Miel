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
      error: "workers.errors.duplicateDoc",
    });
  });
});

describe("deleteWorker (S21-02b)", () => {
  it("borra por id y avisa si no borró nada", async () => {
    const select = vi.fn(async () => ({ data: [{ id: "w" }], error: null }));
    const eq = vi.fn(() => ({ select }));
    const del = vi.fn(() => ({ eq }));
    clientState.current = { from: vi.fn(() => ({ delete: del })) } as never;
    const { deleteWorker } = await import("./workers");

    expect(await deleteWorker("11111111-1111-4111-8111-111111111111")).toEqual({ ok: true });
    expect(eq).toHaveBeenCalledWith("id", "11111111-1111-4111-8111-111111111111");

    select.mockResolvedValueOnce({ data: [], error: null });
    expect((await deleteWorker("11111111-1111-4111-8111-111111111111")).ok).toBe(false);
  });

  it("id inválido → error sin tocar la BD", async () => {
    const from = vi.fn();
    clientState.current = { from } as never;
    const { deleteWorker } = await import("./workers");

    expect((await deleteWorker("x")).ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});

describe("quickCreateWorkerCategory (S21-02b: + desde la ficha)", () => {
  it("crea y devuelve la categoría para dejarla elegida", async () => {
    const single = vi.fn(async () => ({ data: { id: "c-1", name: "Vendedor" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    clientState.current = { from: vi.fn(() => ({ insert })) } as never;
    const { quickCreateWorkerCategory } = await import("./workers");

    const result = await quickCreateWorkerCategory({ name: "Vendedor", modules: ["ventas"] });

    expect(result).toEqual({ ok: true, category: { id: "c-1", name: "Vendedor" } });
    expect(insert).toHaveBeenCalledWith({ tenant_id: "t-1", name: "Vendedor", modules: ["ventas"] });
  });

  it("módulo desconocido → error", async () => {
    const { quickCreateWorkerCategory } = await import("./workers");
    expect((await quickCreateWorkerCategory({ name: "X", modules: ["finanzas"] })).ok).toBe(false);
  });
});

describe("cargos (S21-02c)", () => {
  it("quickCreateWorkerPosition crea y devuelve el cargo", async () => {
    const single = vi.fn(async () => ({ data: { id: "p-1", name: "Cajero" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    clientState.current = { from: vi.fn(() => ({ insert })) } as never;
    const { quickCreateWorkerPosition } = await import("./workers");

    expect(await quickCreateWorkerPosition(" Cajero ")).toEqual({
      ok: true,
      position: { id: "p-1", name: "Cajero" },
    });
    expect(insert).toHaveBeenCalledWith({ tenant_id: "t-1", name: "Cajero" });
  });

  it("createWorker guarda cargo, tipo, valor hora y urgencia", async () => {
    clientState.current = mockSupabase(null);
    const { createWorker } = await import("./workers");
    const POS = "22222222-2222-4222-8222-222222222222";

    await createWorker(
      null,
      formData({
        full_name: "Ana",
        doc_number: "1",
        position_id: POS,
        worker_type: "por_horas",
        hourly_rate: "9000",
        emergency_contact_name: "Rosa",
        emergency_phone: "300",
      }),
    );

    expect(clientState.current.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        position_id: POS,
        worker_type: "por_horas",
        hourly_rate: 9000,
        emergency_contact_name: "Rosa",
        emergency_phone: "300",
      }),
    );
  });
});

describe("acceso con código (S21-03)", () => {
  const W = "11111111-1111-4111-8111-111111111111";

  it("asigna usuario y código por la RPC (el código nunca se guarda en claro)", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    clientState.current = { rpc } as never;
    const { setWorkerPinAccess } = await import("./workers");

    const r = await setWorkerPinAccess(null, formData({ worker_id: W, username: "ana", pin: "1234", pin_confirm: "1234" }));

    expect(r).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_worker_pin", { p_worker_id: W, p_username: "ana", p_pin: "1234" });
  });

  it("los dos códigos deben coincidir y ser 4 números", async () => {
    const rpc = vi.fn();
    clientState.current = { rpc } as never;
    const { setWorkerPinAccess } = await import("./workers");

    expect(
      await setWorkerPinAccess(null, formData({ worker_id: W, username: "ana", pin: "1234", pin_confirm: "4321" })),
    ).toMatchObject({ ok: false });
    expect(
      await setWorkerPinAccess(null, formData({ worker_id: W, username: "ana", pin: "12", pin_confirm: "12" })),
    ).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("usuario repetido en la empresa → mensaje claro", async () => {
    clientState.current = { rpc: vi.fn(async () => ({ error: { code: "23505", message: "dup" } })) } as never;
    const { setWorkerPinAccess } = await import("./workers");

    expect(await setWorkerPinAccess(null, formData({ worker_id: W, username: "ana", pin: "1234", pin_confirm: "1234" }))).toEqual({
      ok: false,
      error: "workers.errors.usernameTaken",
    });
  });
});
