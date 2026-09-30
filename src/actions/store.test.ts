import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyStoreSession } from "@/lib/tenant/store-session";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => jar.set(k, v),
    delete: (k: string) => jar.delete(k),
  }),
}));

const tenant = { current: { tenantId: "t-1", accountRole: "member", storeMode: false } as Record<string, unknown> };
vi.mock("@/lib/tenant/server", () => ({ getActiveTenant: vi.fn(async () => ({ active: tenant.current })) }));

const supa = {
  user: { id: "u-1", email: "tienda@x.co" },
  rpc: vi.fn(),
  signIn: vi.fn(async () => ({ error: null })),
};
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: async () => ({ data: { user: supa.user } }),
      signInWithPassword: supa.signIn,
    },
    rpc: supa.rpc,
  })),
}));

const SECRET = "s".repeat(40);
function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  jar.clear();
  redirect.mockClear();
  process.env.MIEL_SESSION_SECRET = SECRET;
  tenant.current = { tenantId: "t-1", accountRole: "member", storeMode: false };
});

describe("modo tienda (S21-03)", () => {
  it("solo una cuenta operativa activa el modo tienda", async () => {
    const { activateStoreMode } = await import("./store");
    tenant.current = { tenantId: "t-1", accountRole: "owner", storeMode: false };
    expect(await activateStoreMode()).toMatchObject({ ok: false });
    expect(jar.size).toBe(0);

    tenant.current = { tenantId: "t-1", accountRole: "member", storeMode: false };
    await activateStoreMode();
    const session = verifyStoreSession(jar.get("miel_store"), SECRET, Date.now());
    expect(session).toMatchObject({ userId: "u-1", tenantId: "t-1", workerId: null });
    expect(redirect).toHaveBeenCalledWith("/trabajador");
  });

  it("código correcto identifica al trabajador; incorrecto da un error genérico", async () => {
    const { activateStoreMode, identifyWorker } = await import("./store");
    await activateStoreMode();
    tenant.current = { tenantId: "t-1", accountRole: "member", storeMode: true };

    supa.rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await identifyWorker(null, fd({ username: "ana", pin: "0000" }))).toEqual({
      ok: false,
      error: "store.errors.invalidPin",
    });

    supa.rpc.mockResolvedValueOnce({ data: [{ worker_id: "w-1", full_name: "Ana", modules: ["ventas"] }], error: null });
    await identifyWorker(null, fd({ username: "ana", pin: "1234" }));
    expect(verifyStoreSession(jar.get("miel_store"), SECRET, Date.now())?.workerId).toBe("w-1");
    expect(redirect).toHaveBeenLastCalledWith("/inicio");
  });

  it("usuario bloqueado → avisa que espere", async () => {
    const { activateStoreMode, identifyWorker } = await import("./store");
    await activateStoreMode();
    tenant.current = { tenantId: "t-1", accountRole: "member", storeMode: true };
    supa.rpc.mockResolvedValueOnce({ data: null, error: { message: "locked" } });

    expect(await identifyWorker(null, fd({ username: "ana", pin: "1234" }))).toEqual({
      ok: false,
      error: "store.errors.tooManyAttempts",
    });
  });

  it("salir del modo tienda exige la contraseña de la cuenta", async () => {
    const { activateStoreMode, exitStoreMode } = await import("./store");
    await activateStoreMode();
    tenant.current = { tenantId: "t-1", accountRole: "member", storeMode: true };

    supa.signIn.mockResolvedValueOnce({ error: { message: "bad" } } as never);
    expect(await exitStoreMode(null, fd({ password: "mala" }))).toMatchObject({ ok: false });
    expect(jar.has("miel_store")).toBe(true);

    await exitStoreMode(null, fd({ password: "buena" }));
    expect(supa.signIn).toHaveBeenLastCalledWith({ email: "tienda@x.co", password: "buena" });
    expect(jar.has("miel_store")).toBe(false);
  });
});
