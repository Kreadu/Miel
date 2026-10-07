"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { useMyOrders } from "./my-orders-store";

/** S27-04: acceso a "Mis pedidos" en el encabezado, solo si este navegador tiene alguno. */
export function MyOrdersLink({ slug }: { slug: string }) {
  const t = useTranslations("onlineStore.track");
  const orders = useMyOrders(slug);
  if (orders.length === 0) return null;
  return (
    <Link href={`/tienda/${slug}/mis-pedidos`} className="flex h-10 shrink-0 items-center rounded-md px-2 text-sm hover:bg-muted">
      {t("myOrders")}
    </Link>
  );
}
