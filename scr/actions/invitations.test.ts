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

function mockSupabase(overrides: { insertResult?: unknown }) {
  return {
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
      formData({ email: "nuevo@miel.test", role: "member" })
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
      formData({ email: "otro@miel.test", role: "admin" })
    );

    expect(result).toMatchObject({ ok: true, link: "http://localhost:3000/invite/tok-123" });
    expect(JSON.stringify(result)).not.toContain("resend: rate limited");
  });
});
