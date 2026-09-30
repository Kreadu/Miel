/**
 * S21-02: listas de RRHH (Miel). Módulos que puede ver una categoría de trabajador — mismos
 * ids que el check de worker_categories.modules; `href` es el del menú (nav-visibility).
 */
export const WORKER_MODULES = [
  { id: "ventas", label: "Vender", href: "/ventas" },
  { id: "inventario", label: "Inventario", href: "/inventario" },
  { id: "compras", label: "Comprar", href: "/compras" },
  { id: "gastos", label: "Gastos", href: "/gastos" },
  { id: "rrhh", label: "RRHH", href: "/equipo" },
] as const;
export type WorkerModule = (typeof WORKER_MODULES)[number]["id"];
export const WORKER_MODULE_IDS = WORKER_MODULES.map((m) => m.id) as [WorkerModule, ...WorkerModule[]];

export const DOC_TYPES = { cc: "C.C.", ce: "C.E.", ti: "T.I.", pasaporte: "Pasaporte", ppt: "PPT" } as const;
export const CONTRACT_TYPES = {
  indefinido: "Término indefinido",
  fijo: "Término fijo",
  obra_labor: "Obra o labor",
  aprendizaje: "Aprendizaje",
  prestacion_servicios: "Prestación de servicios",
} as const;
export const WORK_SCHEDULES = {
  completa: "Jornada completa",
  medio_tiempo: "Medio tiempo",
  por_horas: "Por horas",
} as const;

/** S21-02c: planta (Trabajadores) vs temporales o por horas (área aparte en RRHH). */
export const WORKER_TYPES = {
  planta: "De planta",
  temporal: "Temporal",
  por_horas: "Por horas",
} as const;

export const keysOf = <T extends Record<string, string>>(o: T) =>
  Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
