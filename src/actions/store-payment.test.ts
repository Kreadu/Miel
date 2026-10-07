import { describe, expect, it, vi } from "vitest";

const upload = vi.fn(async () => ({ error: null as { message: string } | null }));
const rpc = vi.fn(async () => ({ error: null as { message: string } | null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc, storage: { from: () => ({ upload }) } })),
}));

const TOKEN = "6f1c2a4e-9b7d-4c3a-8e2f-1a2b3c4d5e6f";

function fd(token: string, file?: File) {
  const f = new FormData();
  f.set("token", token);
  if (file) f.set("proof", file);
  return f;
}
const jpg = (bytes = 10) => new File([new Uint8Array(bytes)], "c.jpg", { type: "image/jpeg" });

describe("uploadPaymentProof (S27-03)", () => {
  it("sube a la carpeta del token con nombre nuevo y lo registra", async () => {
    upload.mockClear();
    rpc.mockClear();
    const { uploadPaymentProof } = await import("./store-payment");

    expect(await uploadPaymentProof(null, fd(TOKEN, jpg()))).toEqual({ ok: true });
    const path = (upload.mock.calls[0] as unknown[])[0] as string;
    expect(path).toMatch(new RegExp(`^${TOKEN}/[0-9a-f-]{36}\\.jpg$`));
    expect(rpc).toHaveBeenCalledWith("attach_payment_proof", { p_token: TOKEN, p_path: path });
  });

  it.each([
    ["token inválido", fd("nope", jpg()), "onlineStore.proof.errors.invalid"],
    ["sin archivo", fd(TOKEN), "onlineStore.proof.errors.fileRequired"],
    ["tipo no permitido", fd(TOKEN, new File(["x"], "a.exe", { type: "application/x-msdownload" })), "onlineStore.proof.errors.fileType"],
    ["más de 5 MB", fd(TOKEN, jpg(5 * 1024 * 1024 + 1)), "onlineStore.proof.errors.fileSize"],
  ])("rechaza %s sin subir nada", async (_name, data, error) => {
    upload.mockClear();
    const { uploadPaymentProof } = await import("./store-payment");
    expect(await uploadPaymentProof(null, data)).toEqual({ ok: false, error });
    expect(upload).not.toHaveBeenCalled();
  });

  it("Storage o la BD lo rechazan (token vencido, sexta subida)", async () => {
    const { uploadPaymentProof } = await import("./store-payment");
    upload.mockResolvedValueOnce({ error: { message: "new row violates row-level security policy" } });
    expect(await uploadPaymentProof(null, fd(TOKEN, jpg()))).toEqual({ ok: false, error: "onlineStore.proof.errors.invalid" });
    rpc.mockResolvedValueOnce({ error: { message: "proof_invalid" } });
    expect(await uploadPaymentProof(null, fd(TOKEN, jpg()))).toEqual({ ok: false, error: "onlineStore.proof.errors.invalid" });
  });
});
