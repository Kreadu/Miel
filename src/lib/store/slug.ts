/** S27-01: mismas reglas que los CHECK de tenants (formato y palabras reservadas). */
const FORMAT = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "miel", "tienda", "tiendas", "login", "signup", "auth",
  "mail", "email", "soporte", "support", "ayuda", "help", "blog", "docs", "status", "cdn",
  "static", "assets", "img", "media", "files", "dev", "staging", "test", "demo",
]);

/** "Panadería Ñoño & Cía." → "panaderia-nono-cia". */
export function normalizeStoreSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidStoreSlug(slug: string): boolean {
  return FORMAT.test(slug) && !RESERVED_SLUGS.has(slug);
}
