import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant/server", () => ({
  getActiveTenant: vi.fn(async () => ({ active: { tenantId: "t-1" } })),
}));

const clientState: { current: unknown } = { current: null };
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => clientState.current) }));

function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const base = {
  kind: "fixed",
  category: "Arriendo",
  description: "Local",
  amount: "1500000",
  method: "transfer",
  paid_on: "2026-09-05",
  supplier_id: "__none__",
};

describe("createExpense (S22-01)", () => {
  it("inserta con columnas explícitas, fecha a mediodía de Bogotá, sin proveedor → null", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    clientState.current = {
      auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
      from: vi.fn(() => ({ insert })),
    };
    const { createExpense } = await import("./expenses");

    expect(await createExpense(null, fd(base))).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith({
      tenant_id: "t-1",
      created_by: "u-1",
      kind: "fixed",
      category: "Arriendo",
      description: "Local",
      amount: 1_500_000,
      method: "transfer",
      paid_at: "2026-09-05T17:00:00.000Z",
      supplier_id: null,
    });
  });

  it("sin categoría → error sin tocar la BD", async () => {
    const from = vi.fn();
    clientState.current = { auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) }, from };
    const { createExpense } = await import("./expenses");

    expect(await createExpense(null, fd({ ...base, category: "" }))).toEqual({ ok: false, error: "Elige la categoría" });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("quickCreateExpenseCategory (S22-01: + en la hoja)", () => {
  it("crea la categoría con el tipo de la hoja y la devuelve", async () => {
    const single = vi.fn(async () => ({ data: { name: "Música ambiental" }, error: null }));
    const insert = vi.fn(() => ({ select: () => ({ single }) }));
    clientState.current = { from: vi.fn(() => ({ insert })) };
    const { quickCreateExpenseCategory } = await import("./expenses");

    expect(await quickCreateExpenseCategory({ name: " Música ambiental ", kind: "fixed" })).toEqual({
      ok: true,
      name: "Música ambiental",
    });
    expect(insert).toHaveBeenCalledWith({ tenant_id: "t-1", name: "Música ambiental", kind: "fixed" });
  });

  it("nombre repetido → mensaje claro", async () => {
    const single = vi.fn(async () => ({ data: null, error: { code: "23505" } }));
    clientState.current = { from: vi.fn(() => ({ insert: () => ({ select: () => ({ single }) }) })) };
    const { quickCreateExpenseCategory } = await import("./expenses");

    expect(await quickCreateExpenseCategory({ name: "Arriendo", kind: "fixed" })).toEqual({
      ok: false,
      error: "Ya existe una categoría con ese nombre.",
    });
  });
});
