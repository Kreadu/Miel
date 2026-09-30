/**
 * S21-02: listas de RRHH (Miel). Módulos que puede ver una categoría de trabajador — mismos
 * ids que el check de worker_categories.modules; `href` es el del menú (nav-visibility).
 */
export const WORKER_MODULES = [
  { id: "ventas", href: "/ventas" },
  { id: "inventario", href: "/inventario" },
  { id: "compras", href: "/compras" },
  { id: "gastos", href: "/gastos" },
  { id: "rrhh", href: "/equipo" },
] as const;
export type WorkerModule = (typeof WORKER_MODULES)[number]["id"];
export const WORKER_MODULE_IDS = WORKER_MODULES.map((m) => m.id) as [WorkerModule, ...WorkerModule[]];

/**
 * S21-03: módulos que se pueden dar por categoría. Gastos y RRHH quedan fuera: la BD solo deja
 * leerlos a administradores (salarios, gastos), así que a un trabajador le aparecerían vacíos.
 */
export const CATEGORY_MODULES = WORKER_MODULES.filter((m) => m.id !== "gastos" && m.id !== "rrhh");

// S20-07: etiquetas en los mensajes (`rrhh.docTypes.*`, `rrhh.contractTypes.*`, …).
export const DOC_TYPES = ["cc", "ce", "ti", "pasaporte", "ppt"] as const;
export const CONTRACT_TYPES = ["indefinido", "fijo", "obra_labor", "aprendizaje", "prestacion_servicios"] as const;
export const WORK_SCHEDULES = ["completa", "medio_tiempo", "por_horas"] as const;

/** S21-02c: planta (Trabajadores) vs temporales o por horas (área aparte en RRHH). */
export const WORKER_TYPES = ["planta", "temporal", "por_horas"] as const;

/** S21-04: para finanzas, el pago del trabajador es gasto o costo (de producción/venta), fijo o variable. */
export const COST_CLASSIFICATIONS = ["gasto_fijo", "gasto_variable", "costo_fijo", "costo_variable"] as const;
