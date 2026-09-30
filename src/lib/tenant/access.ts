import { WORKER_MODULES } from "@/lib/rrhh/workers";

import type { Role } from "./active-tenant";

export type ActiveWorker = { id: string; name: string; modules: string[] };

export type Access = {
  /** Rol efectivo: en modo tienda siempre "member" (lo que ve un operativo). */
  role: Role;
  /** Módulos visibles; null = sin restricción. */
  modules: string[] | null;
  storeMode: boolean;
  worker: ActiveWorker | null;
  /** Modo tienda sin trabajador identificado: hay que pedir el código. */
  needsWorker: boolean;
};

/**
 * S21-03 (ADR-037): qué ve cada quien. Dueño/admin: todo. Operativo con categoría: sus módulos;
 * sin categoría: todo lo de un operativo (los que existían antes de las categorías). En el
 * equipo de la tienda manda el trabajador identificado con su código.
 */
export function resolveAccess(
  accountRole: Role,
  membershipModules: string[] | null,
  store: { worker: ActiveWorker | null } | null,
): Access {
  if (store) {
    return {
      role: "member",
      modules: store.worker ? store.worker.modules : [],
      storeMode: true,
      worker: store.worker,
      needsWorker: !store.worker,
    };
  }
  const restricted = accountRole === "member" && membershipModules !== null;
  return {
    role: accountRole,
    modules: restricted ? membershipModules : null,
    storeMode: false,
    worker: null,
    needsWorker: false,
  };
}

/** ¿Puede ver esta ruta? Inicio siempre; el resto según el módulo al que pertenece. */
export function canSeeHref(href: string, modules: string[] | null): boolean {
  if (modules === null || href === "/inicio" || href.startsWith("/inicio/")) return true;
  const owner = WORKER_MODULES.find((m) => href === m.href || href.startsWith(`${m.href}/`));
  return owner ? modules.includes(owner.id) : false;
}
