import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadStore } from "@/lib/store/load";

import { storeMetadata } from "../metadata";
import { StoreShell } from "../store-shell";
import { MyOrdersList } from "./my-orders-list";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("onlineStore.track");
  return { ...(await storeMetadata(slug, t("myOrders"))), robots: { index: false, follow: false } };
}

/** S27-04: pedidos hechos desde este navegador (no hay cuentas de cliente). */
export default async function MyOrdersPage({ params }: Props) {
  const { slug } = await params;
  const store = await loadStore(slug);
  if (!store) notFound();
  return (
    <StoreShell slug={slug} info={store.info}>
      <MyOrdersList slug={slug} />
    </StoreShell>
  );
}
