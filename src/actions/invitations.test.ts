import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Map([["origin", "http://localhost:3000"]])),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const activeTenant = {
  tenantId: "tenant-1",
  tenantName: "Miel Demo",
  role: "owner" as const,
};

vi.mock("@/lib/tenant/server", () => ({
  getActiveTenant: vi.fn(async () => ({ active: activeTenant, memberships: [] })),
}));

const rpcMock = vi.fn<(name: string, args: unknown) => Promise<{ error: { message: string } | null }>>(async () => ({ error: null }));

function mockSupabase(overrides: { insertResult?: unknown }) {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { email: "Duena@Miel.co" } } })) },
    rpc: rpcMock,
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(
            async () => overrides.insertResult ?? { data: { token: "tok-123" }, error: null }
          ),
        })),
      })),
    })),
  };
}

const clientState: { current: ReturnType<typeof mockSupabase> } = {
  current: mockSupabase({}),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => clientState.current),
}));

const sendEmailMock = vi.fn<(params: unknown) => Promise<{ ok: boolean }>>(async () => ({
  ok: true,
}));

vi.mock("@/lib/email/invitation-email", () => ({
  sendInvitationEmail: (arg: unknown) => sendEmailMock(arg),
}));

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("createInvitation — envío de correo (S12-03)", () => {
  it("crea la invitación y envía el correo con el enlace", async () => {
    clientState.current = mockSupabase({});
    sendEmailMock.mockResolvedValueOnce({ ok: true });
    const { createInvitation } = await import("./invitations");

    const result = await createInvitation(
      null,
      formData({ email: "nuevo@miel.test", access: "tienda" })
    );

    expect(result).toMatchObject({ ok: true, link: "http://localhost:3000/invite/tok-123" });
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "nuevo@miel.test",
        tenantName: "Miel Demo",
        role: "member",
        link: "http://localhost:3000/invite/tok-123",
      })
    );
  });

  it("si el envío de correo falla, la invitación sigue creada y no se lanza excepción", async () => {
    clientState.current = mockSupabase({});
    sendEmailMock.mockRejectedValueOnce(new Error("resend: rate limited"));
    const { createInvitation } = await import("./invitations");

    const result = await createInvitation(
      null,
      formData({ email: "otro@miel.test", access: "admin" })
    );

    expect(result).toMatchObject({ ok: true, link: "http://localhost:3000/invite/tok-123" });
    expect(JSON.stringify(result)).not.toContain("resend: rate limited");
  });
});

describe("createInvitation con mi propio correo (S26-12)", () => {
  it("no invita: conecta la ficha a mi cuenta", async () => {
    clientState.current = mockSupabase({});
    sendEmailMock.mockClear();
    const { createInvitation } = await import("./invitations");
    const result = await createInvitation(
      null,
      formData({ email: "duena@miel.co", access: "admin", worker_id: "11111111-1111-4111-8111-111111111111" }),
    );
    expect(result).toEqual({ ok: true, linked: true });
    expect(rpcMock).toHaveBeenCalledWith("link_worker_to_me", { p_worker_id: "11111111-1111-4111-8111-111111111111" });
    expect(clientState.current.from).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("ficha ya conectada a otra cuenta: error claro", async () => {
    clientState.current = mockSupabase({});
    rpcMock.mockImplementationOnce(async () => ({ error: { message: "worker_linked" } }));
    const { createInvitation } = await import("./invitations");
    expect(
      await createInvitation(
        null,
        formData({ email: "duena@miel.co", access: "admin", worker_id: "11111111-1111-4111-8111-111111111111" }),
      ),
    ).toEqual({ ok: false, error: "invitations.errors.workerLinked" });
  });
});
