"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { formatDate } from "@/lib/format";

import { useMyOrders } from "../my-orders-store";

export function MyOrdersList({ slug }: { slug: string }) {
  const t = useTranslations("onlineStore");
  const orders = useMyOrders(slug);

  return (
    <section className="mx-auto flex max-w-md flex-col gap-3">
      <h1 className="text-xl font-semibold tracking-tight">{t("track.myOrders")}</h1>
      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("track.noOrders")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {orders.map((o) => (
            <li key={o.token}>
              <Link href={`/tienda/${slug}/pedido/${o.token}`} className="flex min-h-12 items-center justify-between px-4 py-2 text-sm hover:bg-muted">
                <span className="font-medium tabular-nums">#{o.code}</span>
                <span className="text-muted-foreground">{formatDate(o.at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t("track.onlyThisDevice")}</p>
    </section>
  );
}
