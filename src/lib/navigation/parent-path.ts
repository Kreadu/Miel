const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Segmentos que no son una página por sí solos (solo existen con un id detrás). */
const NOT_A_PAGE = new Set(["kardex"]);

/**
 * S19-33: "Volver" sube a la sección de arriba en vez de usar el historial del navegador
 * (que llevaba a la última pantalla abierta, filtros incluidos). Salta los ids y los segmentos
 * que no son página; un módulo principal vuelve a /inicio.
 */
export function parentPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  segments.pop();
  while (segments.length > 0) {
    const last = segments[segments.length - 1];
    if (!UUID.test(last) && !NOT_A_PAGE.has(last)) break;
    segments.pop();
  }
  return segments.length > 0 ? `/${segments.join("/")}` : "/inicio";
}
