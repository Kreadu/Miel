import { getTranslations } from "next-intl/server";

import { INVENTORIES } from "@/lib/inventories";

import { InventoryView } from "../inventory-view";

export async function generateMetadata() {
  const t = await getTranslations("inventory.types.productos");
  return { title: `${t("title")} · Miel` };
}

/** Ruta estática propia (tiene /[id]/receta debajo); la vista es la misma de todo inventario. */
export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{
    categoria?: string;
    historial?: string;
    desde?: string;
    hasta?: string;
    bodega?: string;
  }>;
}) {
  const { categoria, ...history } = await searchParams;
  return <InventoryView inventory={INVENTORIES[0]} categoria={categoria} history={history} />;
}
