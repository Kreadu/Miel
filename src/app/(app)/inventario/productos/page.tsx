import { INVENTORIES } from "@/lib/inventories";

import { InventoryView } from "../inventory-view";

export const metadata = { title: "Inventario de productos · Miel" };

/** Ruta estática propia (tiene /[id]/receta debajo); la vista es la misma de todo inventario. */
export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
  return <InventoryView inventory={INVENTORIES[0]} categoria={categoria} />;
}
