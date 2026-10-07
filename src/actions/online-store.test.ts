import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant/server", () => ({ getActiveTenant: vi.fn(async () => ({ active: { tenantId: "t-1" } })) }));

type Result = { data: { id: string }[] | null; error: { code: string; message: string } | null };
const updateResult: { current: Result } = { current: { data: [{ id: "t-1" }], error: null } };
const eq = vi.fn(() => ({ select: async () => updateResult.current }));
const update = vi.fn(() => ({ eq }));
const upload = vi.fn(async () => ({ error: null as { message: string } | null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ update }),
    storage: { from: () => ({ upload, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x/${path}` } }) }) },
  })),
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

describe("saveStorePayments (S27-03)", () => {
  it("guarda números, cuenta y casillas; vacíos → null", async () => {
    updateResult.current = { data: [{ id: "t-1" }], error: null };
    update.mockClear();
    const { saveStorePayments } = await import("./online-store");

    const res = await saveStorePayments(
      null,
      fd({ nequi: " 300 123 4567 ", daviplata: "", bank_info: "Bancolombia 123", cash_on_delivery: "on" }),
    );

    expect(res).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({
      store_nequi: "300 123 4567",
      store_daviplata: null,
      store_bank_info: "Bancolombia 123",
      store_cash_on_delivery: true,
      store_pay_in_store: false,
    });
  });

  it("sube el QR a la carpeta de la empresa y guarda su URL", async () => {
    updateResult.current = { data: [{ id: "t-1" }], error: null };
    update.mockClear();
    upload.mockClear();
    const { saveStorePayments } = await import("./online-store");
    const f = fd({ nequi: "", daviplata: "", bank_info: "" });
    f.set("qr", new File([new Uint8Array(10)], "qr.png", { type: "image/png" }));

    expect(await saveStorePayments(null, f)).toEqual({ ok: true });
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^t-1\/qr-.+\.png$/), expect.any(File), { contentType: "image/png" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ store_payment_qr_url: expect.stringMatching(/^https:\/\/x\/t-1\/qr-/) }));
  });

  it.each([
    [{ nequi: "12" }, "onlineStore.errors.walletInvalid"],
    [{ daviplata: "abc" }, "onlineStore.errors.walletInvalid"],
    [{ bank_info: "x".repeat(301) }, "common.errors.textTooLong"],
  ])("valida %o → %s", async (fields, error) => {
    update.mockClear();
    const { saveStorePayments } = await import("./online-store");
    expect(await saveStorePayments(null, fd({ nequi: "", daviplata: "", bank_info: "", ...fields }))).toEqual({ ok: false, error });
    expect(update).not.toHaveBeenCalled();
  });

  it("QR de tipo inválido", async () => {
    const { saveStorePayments } = await import("./online-store");
    const f = fd({ nequi: "", daviplata: "", bank_info: "" });
    f.set("qr", new File([new Uint8Array(10)], "qr.gif", { type: "image/gif" }));
    expect(await saveStorePayments(null, f)).toEqual({ ok: false, error: "company.errors.logoType" });
  });
});
