import { Resend } from "resend";

const ROLE_LABEL: Record<"admin" | "member", string> = {
  admin: "administrador",
  member: "miembro",
};

/** Sin acceso a Resend (dev sin cuenta configurada): no bloquea el flujo de invitación. */
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export function buildInvitationEmail(params: {
  tenantName: string;
  role: "admin" | "member";
  link: string;
}) {
  const { tenantName, role, link } = params;
  return {
    subject: `Te invitaron a ${tenantName} en Miel`,
    html: `
      <p>Te invitaron a unirte a <strong>${tenantName}</strong> en Miel como <strong>${ROLE_LABEL[role]}</strong>.</p>
      <p><a href="${link}">${link}</a></p>
      <p>Debes registrarte con este mismo correo para que la invitación se acepte.</p>
    `.trim(),
  };
}

/** No lanza: un fallo de envío no debe revertir la invitación ya creada (criterio 2, S12-03). */
export async function sendInvitationEmail(params: {
  to: string;
  tenantName: string;
  role: "admin" | "member";
  link: string;
}): Promise<{ ok: boolean }> {
  if (!resend) return { ok: false };

  const { subject, html } = buildInvitationEmail(params);
  try {
    await resend.emails.send({ from: "Miel <onboarding@resend.dev>", to: params.to, subject, html });
    return { ok: true };
  } catch (error) {
    console.error("sendInvitationEmail:", error);
    return { ok: false };
  }
}
