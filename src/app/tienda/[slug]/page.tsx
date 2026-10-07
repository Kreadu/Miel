import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadStore } from "@/lib/store/load";

import { storeMetadata } from "./metadata";
import { StoreCatalog } from "./store-catalog";
import { StoreShell } from "./store-shell";

type Props = { params: Promise<{ slug: string }> };

/** S27-01: marca blanca — título, ícono e instalación con la empresa; nada de Miel. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return storeMetadata(slug);
}

export default async function StorePage({ params }: Props) {
  const { slug } = await params;
  const store = await loadStore(slug);
  if (!store) notFound();

  return (
    <StoreShell slug={slug} info={store.info}>
      <StoreCatalog slug={slug} products={store.products} currency={store.info.currency} />
    </StoreShell>
  );
}
