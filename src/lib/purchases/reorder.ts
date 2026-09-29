import { z } from "zod";

/** S19-27: cantidad sugerida para reponer desde Alertas — hasta el doble del stock mínimo. */
export function suggestedReorderQty(minStock: number, currentQty: number): number {
  return Math.max(minStock * 2 - currentQty, 1);
}

const uuid = z.uuid();

/** S19-27: ids de producto que Alertas manda a la orden de compra (`?desde=<id>,<id>`). */
export function parseProductIds(raw: string | undefined): string[] {
  if (!raw) return [];
  const ids = raw.split(",").filter((id) => uuid.safeParse(id).success);
  return [...new Set(ids)];
}
