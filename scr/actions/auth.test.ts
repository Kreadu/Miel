import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Map([["origin", "http://localhost:3000"]])),
}));

function mockSupabase(overrides: {
  signInWithPassword?: unknown;
  signUp?: unknown;
  resetPasswordForEmail?: unknown;
}) {
  return {
    auth: {
      signInWithPassword: vi.fn(async () => overrides.signInWithPassword ?? { error: null }),
      signUp: vi.fn(async () => overrides.signUp ?? { error: null }),
      resetPasswordForEmail: vi.fn(
        async () => overrides.resetPasswordForEmail ?? { error: null }
      ),
    },
  };
}

const clientState: { current: ReturnType<typeof mockSupabase> } = {
  current: mockSupabase({}),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => clientState.current),
}));

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("auth actions — preservación del correo tras error", () => {
  it("login con credenciales inválidas devuelve el email enviado", async () => {
    clientState.current = mockSupabase({
      signInWithPassword: { error: { code: "invalid_credentials" } },
    });
    const { login } = await import("./auth");

    const result = await login(null, formData({ email: "ana@miel.test", password: "wrongpass" }));

    expect(result).toMatchObject({ ok: false, email: "ana@miel.test" });
  });

  it("login con email inválido (falla Zod) también devuelve el email crudo", async () => {
    const { login } = await import("./auth");

    const result = await login(null, formData({ email: "no-es-un-email", password: "x" }));

    expect(result).toMatchObject({ ok: false, email: "no-es-un-email" });
  });

  it("el estado de error nunca incluye la contraseña", async () => {
    clientState.current = mockSupabase({
      signInWithPassword: { error: { code: "invalid_credentials" } },
    });
    const { login } = await import("./auth");

    const result = await login(
      null,
      formData({ email: "ana@miel.test", password: "super-secreta" })
    );

    expect(JSON.stringify(result)).not.toContain("super-secreta");
    expect(result).not.toHaveProperty("password");
  });

  it("signup con error conserva el email", async () => {
    clientState.current = mockSupabase({
      signUp: { error: { code: "user_already_exists" } },
    });
    const { signup } = await import("./auth");

    const result = await signup(
      null,
      formData({ email: "nueva@miel.test", password: "password123" })
    );

    expect(result).toMatchObject({ ok: false, email: "nueva@miel.test" });
  });

  it("requestPasswordReset conserva el email en error, no en éxito", async () => {
    clientState.current = mockSupabase({
      resetPasswordForEmail: { error: { code: "over_email_send_rate_limit" } },
    });
    const { requestPasswordReset } = await import("./auth");

    const errorResult = await requestPasswordReset(null, formData({ email: "ana@miel.test" }));
    expect(errorResult).toMatchObject({ ok: false, email: "ana@miel.test" });

    clientState.current = mockSupabase({});
    const okResult = await requestPasswordReset(null, formData({ email: "ana@miel.test" }));
    expect(okResult).toMatchObject({ ok: true });
    expect(okResult).not.toHaveProperty("email");
  });
});
