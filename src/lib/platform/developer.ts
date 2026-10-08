/**
 * S27-08: datos de Kreadu, la empresa que desarrolla Miel. Pie fijo en todas las tiendas (ADR-045)
 * para que cualquiera que vea una tienda pueda contactarla. Enlace o red sin `url` = no se enlaza
 * o no se muestra (pendiente de que el humano dé las direcciones).
 */
export const DEVELOPER = {
  brand: "KREADU",
  legal: "KREADU S.A.S. — NIT 901790185-0",
  company: {
    title: "Company",
    links: [
      { label: "AI Business Systems Lab", url: null },
      { label: "Academy", url: null },
      { label: "KREADU School", url: null },
    ] as { label: string; url: string | null }[],
  },
  contact: {
    title: "Contact",
    cta: "Let's Talk",
    email: "is@kreadu.com",
    phones: ["(+57) 3235297951", "(+57) 3225832662"],
  },
  social: {
    title: "Social",
    links: [] as { label: string; url: string }[],
  },
} as const;

/** "(+57) 3235297951" → enlace de WhatsApp. */
export function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
