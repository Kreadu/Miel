import { z } from "zod";

const isoDate = z.iso.date();
const uuid = z.uuid();

/** Hoy en Bogotá como YYYY-MM-DD (misma zona que usa inventory_history). */
export function todayInBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

/**
 * S19-34: filtros del Historial de un inventario a partir de la URL (`?desde&hasta&bodega`).
 * Por defecto, del 1 del mes a hoy y todas las bodegas; un rango invertido se da vuelta.
 */
export function historyFilters(
  params: { desde?: string; hasta?: string; bodega?: string },
  today: string,
): { from: string; to: string; warehouseId: string | null } {
  let from = isoDate.safeParse(params.desde).success ? params.desde! : `${today.slice(0, 8)}01`;
  let to = isoDate.safeParse(params.hasta).success ? params.hasta! : today;
  if (from > to) [from, to] = [to, from];
  const warehouseId = uuid.safeParse(params.bodega).success ? params.bodega! : null;
  return { from, to, warehouseId };
}
