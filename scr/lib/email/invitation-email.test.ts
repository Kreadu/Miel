import { describe, expect, it } from "vitest";

import { buildInvitationEmail } from "./invitation-email";

describe("buildInvitationEmail", () => {
  const params = {
    tenantName: "Miel Demo",
    role: "admin" as const,
    link: "https://miel.app/invite/abc-123-token",
  };

  it("incluye el nombre del tenant, el rol y el enlace de invitación", () => {
    const email = buildInvitationEmail(params);

    expect(email.subject).toContain("Miel Demo");
    expect(email.html).toContain("Miel Demo");
    expect(email.html).toContain("admin");
    expect(email.html).toContain(params.link);
  });

  it("avisa que el invitado debe registrarse con ese mismo correo", () => {
    const email = buildInvitationEmail(params);

    expect(email.html.toLowerCase()).toContain("mismo correo");
  });

  it("nunca expone el token fuera del enlace (ni en el asunto, ni suelto en el cuerpo)", () => {
    const email = buildInvitationEmail(params);
    const token = "abc-123-token";

    expect(email.subject).not.toContain(token);
    // El token solo debe aparecer como parte del enlace completo.
    const htmlWithoutLink = email.html.split(params.link).join("");
    expect(htmlWithoutLink).not.toContain(token);
  });
});
