import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadStore } from "@/lib/store/load";
import { parseStorePayments } from "@/lib/store/payments";

import { storeMetadata } from "../metadata";
import { StoreShell } from "../store-shell";
import { CartView } from "./cart-view";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("onlineStore.cart");
  return storeMetadata(slug, t("title"));
}

/** S27-02: carrito y pedido como invitado. */
export default async function CartPage({ params }: Props) {
  const { slug } = await params;
  const store = await loadStore(slug);
  if (!store) notFound();

  return (
    <StoreShell slug={slug} info={store.info}>
      <CartView
        slug={slug}
        products={store.products}
        currency={store.info.currency}
        storeName={store.info.name}
        storePhone={store.info.phone}
        payments={parseStorePayments(store.info.payments)}
      />
    </StoreShell>
  );
}
