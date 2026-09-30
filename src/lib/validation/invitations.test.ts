import { describe, expect, it } from "vitest";

import { invitationSchema } from "./invitations";

const CAT = "11111111-1111-4111-8111-111111111111";
const W = "22222222-2222-4222-8222-222222222222";

describe("invitationSchema (S21-03: acceso = Administrador, Cuenta de la tienda o una categoría)", () => {
  it("Administrador → rol admin, sin categoría", () => {
    const r = invitationSchema.safeParse({ email: "a@test.local", access: "admin" });
    expect(r.success && r.data).toMatchObject({ role: "admin", category_id: null });
  });

  it("Cuenta de la tienda → operativo sin categoría", () => {
    const r = invitationSchema.safeParse({ email: "a@test.local", access: "tienda" });
    expect(r.success && r.data).toMatchObject({ role: "member", category_id: null });
  });

  it("una categoría → operativo con esa categoría; puede venir desde la ficha de un trabajador", () => {
    const r = invitationSchema.safeParse({ email: "a@test.local", access: CAT, worker_id: W });
    expect(r.success && r.data).toMatchObject({ role: "member", category_id: CAT, worker_id: W });
  });

  it("rechaza correo inválido y accesos desconocidos", () => {
    expect(invitationSchema.safeParse({ email: "no-es-email", access: "admin" }).success).toBe(false);
    expect(invitationSchema.safeParse({ email: "a@test.local", access: "owner" }).success).toBe(false);
    expect(invitationSchema.safeParse({ email: "a@test.local", access: "root" }).success).toBe(false);
  });

  it("normaliza el correo", () => {
    const r = invitationSchema.safeParse({ email: "  A@Test.Local  ", access: "tienda" });
    expect(r.success && r.data.email).toBe("a@test.local");
  });
});
