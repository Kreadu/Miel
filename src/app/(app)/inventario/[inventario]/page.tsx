import { notFound } from "next/navigation";

import { inventoryBySlug } from "@/lib/inventories";

import { InventoryView } from "../inventory-view";

/** S19-26: /inventario/<tipo> para cada inventario que no es el de productos. */
export default async function InventarioTipoPage({
  params,
  searchParams,
}: {
  params: Promise<{ inventario: string }>;
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { inventario } = await params;
  const { categoria } = await searchParams;
  const inventory = inventoryBySlug(inventario);
  if (!inventory || inventory.id === "productos") notFound();
  return <InventoryView inventory={inventory} categoria={categoria} />;
}

export async function generateMetadata({ params }: { params: Promise<{ inventario: string }> }) {
  const { inventario } = await params;
  return { title: `${inventoryBySlug(inventario)?.title ?? "Inventario"} · Miel` };
}
