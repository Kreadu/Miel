import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { inventoryBySlug } from "@/lib/inventories";

import { InventoryView } from "../inventory-view";

/** S19-26: /inventario/<tipo> para cada inventario que no es el de productos. */
export default async function InventarioTipoPage({
  params,
  searchParams,
}: {
  params: Promise<{ inventario: string }>;
  searchParams: Promise<{
    categoria?: string;
    historial?: string;
    desde?: string;
    hasta?: string;
    bodega?: string;
  }>;
}) {
  const { inventario } = await params;
  const { categoria, ...history } = await searchParams;
  const inventory = inventoryBySlug(inventario);
  if (!inventory || inventory.id === "productos") notFound();
  return <InventoryView inventory={inventory} categoria={categoria} history={history} />;
}

export async function generateMetadata({ params }: { params: Promise<{ inventario: string }> }) {
  const { inventario } = await params;
  const t = await getTranslations("inventory");
  const inv = inventoryBySlug(inventario);
  return { title: `${inv ? t(`types.${inv.id}.title`) : t("title")} · Miel` };
}
