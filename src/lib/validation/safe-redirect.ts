export const DEFAULT_AUTHENTICATED_PATH = "/inicio";

/**
 * Anti open redirect (docs/arch/seguridad.md): solo se honran rutas relativas
 * internas — un `/` inicial, sin `//` ni `/\` (protocol-relative) ni esquema.
 */
export function safeNext(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_AUTHENTICATED_PATH;
  if (!/^\/(?![/\\])/.test(value)) return DEFAULT_AUTHENTICATED_PATH;
  return value;
}
