import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant/server", () => ({ getActiveTenant: vi.fn(async () => ({ active: { tenantId: "t-1" } })) }));

type Result = { data: { id: string }[] | null; error: { code: string; message: string } | null };
const updateResult: { current: Result } = { current: { data: [{ id: "t-1" }], error: null } };
const eq = vi.fn(() => ({ select: async () => updateResult.current }));
const update = vi.fn(() => ({ eq }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: () => ({ update }) })),
}));

function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("saveStoreSettings (S27-01)", () => {
  it("normaliza la dirección y guarda", async () => {
    updateResult.current = { data: [{ id: "t-1" }], error: null };
    update.mockClear();
    const { saveStoreSettings } = await import("./online-store");

    expect(await saveStoreSettings(null, fd({ enabled: "on", slug: " Dulce Miel ", color: "#a0522d" }))).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ store_enabled: true, store_slug: "dulce-miel", store_color: "#a0522d" });
    expect(eq).toHaveBeenCalledWith("id", "t-1");
  });

  it("apagada y sin dirección se guarda; sin color queda null", async () => {
    updateResult.current = { data: [{ id: "t-1" }], error: null };
    update.mockClear();
    const { saveStoreSettings } = await import("./online-store");

    expect(await saveStoreSettings(null, fd({ slug: "", color: "" }))).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ store_enabled: false, store_slug: null, store_color: null });
  });

  it.each([
    [{ enabled: "on", slug: "" }, "onlineStore.errors.slugRequired"],
    [{ slug: "ab" }, "onlineStore.errors.slugInvalid"],
    [{ slug: "admin" }, "onlineStore.errors.slugReserved"],
    [{ slug: "abc", color: "red" }, "onlineStore.errors.colorInvalid"],
  ])("valida antes de la BD: %o → %s", async (fields, error) => {
    update.mockClear();
    const { saveStoreSettings } = await import("./online-store");

    expect(await saveStoreSettings(null, fd(fields))).toEqual({ ok: false, error });
    expect(update).not.toHaveBeenCalled();
  });

  it("dirección tomada (23505) y sin permiso (0 filas)", async () => {
    const { saveStoreSettings } = await import("./online-store");
    updateResult.current = { data: null, error: { code: "23505", message: "tenants_store_slug_key" } };
    expect(await saveStoreSettings(null, fd({ slug: "abc" }))).toEqual({ ok: false, error: "onlineStore.errors.slugTaken" });
    updateResult.current = { data: [], error: null };
    expect(await saveStoreSettings(null, fd({ slug: "abc" }))).toEqual({ ok: false, error: "common.errors.permissionDenied" });
  });
});
