import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant/server", () => ({ getActiveTenant: vi.fn(async () => ({ active: { tenantId: "t-1" } })) }));

const updateResult: { current: { data: { id: string }[] | null; error: { code: string } | null } } = {
  current: { data: [{ id: "t-1" }], error: null },
};
const eq = vi.fn(() => ({ select: async () => updateResult.current }));
const update = vi.fn(() => ({ eq }));
const rpc = vi.fn(async () => ({ error: null as { message: string } | null }));
const upload = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ update }),
    rpc,
    storage: { from: () => ({ upload, getPublicUrl: () => ({ data: { publicUrl: "https://x/logo.png" } }) }) },
  })),
}));

function formData(fields: Record<string, string | File>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("saveCompany (S26-01)", () => {
  it("guarda los datos de la empresa", async () => {
    updateResult.current = { data: [{ id: "t-1" }], error: null };
    update.mockClear();
    const { saveCompany } = await import("./company");

    expect(
      await saveCompany(null, formData({ name: " Miel SAS ", nit: "900", address: "Calle 1", city: "Bogotá", phone: "555", email: "a@b.co" })),
    ).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({
      name: "Miel SAS",
      nit: "900",
      address: "Calle 1",
      city: "Bogotá",
      phone: "555",
      email: "a@b.co",
    });
    expect(eq).toHaveBeenCalledWith("id", "t-1");
  });

  it("nombre vacío: error sin tocar la BD", async () => {
    update.mockClear();
    const { saveCompany } = await import("./company");
    expect(await saveCompany(null, formData({ name: " " }))).toEqual({ ok: false, error: "common.errors.nameRequired" });
    expect(update).not.toHaveBeenCalled();
  });

  it("correo inválido", async () => {
    const { saveCompany } = await import("./company");
    expect(await saveCompany(null, formData({ name: "X", email: "no" }))).toEqual({
      ok: false,
      error: "customers.errors.emailInvalid",
    });
  });

  it("logo que no es imagen: error", async () => {
    const { saveCompany } = await import("./company");
    const logo = new File(["x"], "logo.gif", { type: "image/gif" });
    expect(await saveCompany(null, formData({ name: "X", logo }))).toEqual({ ok: false, error: "company.errors.logoType" });
  });

  it("con logo: lo sube a la carpeta de la empresa y guarda la URL", async () => {
    updateResult.current = { data: [{ id: "t-1" }], error: null };
    upload.mockClear();
    update.mockClear();
    const { saveCompany } = await import("./company");
    const logo = new File(["x"], "logo.png", { type: "image/png" });

    expect(await saveCompany(null, formData({ name: "X", logo }))).toEqual({ ok: true });
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^t-1\//), logo, { contentType: "image/png" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ logo_url: "https://x/logo.png" }));
  });

  it("un operativo no puede (RLS no actualiza nada)", async () => {
    updateResult.current = { data: [], error: null };
    const { saveCompany } = await import("./company");
    expect(await saveCompany(null, formData({ name: "X" }))).toEqual({
      ok: false,
      error: "common.errors.permissionDenied",
    });
  });
});
