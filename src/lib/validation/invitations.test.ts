import { describe, expect, it } from "vitest";

import { invitationSchema } from "./invitations";

describe("invitationSchema", () => {
  it("acepta email y rol admin válidos", () => {
    expect(invitationSchema.safeParse({ email: "a@test.local", role: "admin" }).success).toBe(
      true,
    );
  });

  it("acepta email y rol member válidos", () => {
    expect(invitationSchema.safeParse({ email: "a@test.local", role: "member" }).success).toBe(
      true,
    );
  });

  it("rechaza email inválido", () => {
    expect(invitationSchema.safeParse({ email: "no-es-email", role: "admin" }).success).toBe(
      false,
    );
  });

  it("rechaza rol owner (solo admin|member se pueden invitar)", () => {
    expect(invitationSchema.safeParse({ email: "a@test.local", role: "owner" }).success).toBe(
      false,
    );
  });

  it("rechaza rol arbitrario", () => {
    expect(invitationSchema.safeParse({ email: "a@test.local", role: "root" }).success).toBe(
      false,
    );
  });

  it("normaliza el email: recorta espacios y pasa a minúsculas", () => {
    const result = invitationSchema.safeParse({ email: "  A@Test.Local  ", role: "member" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("a@test.local");
    }
  });
});
