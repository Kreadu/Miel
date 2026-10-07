import { Resend } from "resend";

/** S27-04 (H5): sin RESEND_API_KEY (hoy, sin servidor) no se envía nada y no falla. */
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildStoreOrderEmail(p: { storeName: string; code: string; total: string; ordersUrl: string }) {
  return {
    subject: `Pedido nuevo #${p.code} en tu tienda en línea`,
    html: `
      <p>Llegó un pedido nuevo a la tienda en línea de <strong>${escape(p.storeName)}</strong>.</p>
      <p>Pedido <strong>#${escape(p.code)}</strong> · Total <strong>${escape(p.total)}</strong></p>
      <p><a href="${escape(p.ordersUrl)}">Ver y confirmar en Pedidos</a></p>
    `.trim(),
  };
}

/** No lanza: un fallo del correo nunca debe afectar el pedido ya creado. */
export async function sendStoreOrderEmail(p: {
  to: string;
  storeName: string;
  code: string;
  total: string;
  ordersUrl: string;
}): Promise<void> {
  if (!resend) return;
  const { subject, html } = buildStoreOrderEmail(p);
  try {
    await resend.emails.send({ from: "Miel <onboarding@resend.dev>", to: p.to, subject, html });
  } catch (error) {
    console.error("sendStoreOrderEmail:", error);
  }
}
