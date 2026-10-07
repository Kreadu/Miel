/**
 * S26-03: número para wa.me — solo dígitos; un celular colombiano de 10 dígitos (empieza en 3)
 * gana el indicativo 57. Sin dígitos → null (se abre WhatsApp sin destinatario).
 */
export function waPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.length === 10 && digits.startsWith("3") ? `57${digits}` : digits;
}

export function whatsappUrl(phone: string | null | undefined, text: string): string {
  return `https://wa.me/${waPhone(phone) ?? ""}?text=${encodeURIComponent(text)}`;
}
