import { Check, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { loadStore } from "@/lib/store/load";
import { orderTimeline, parseOrderStatus } from "@/lib/store/order-status";
import { createClient } from "@/lib/supabase/server";

import { PaymentInstructions } from "../../carrito/payment-instructions";
import { storeMetadata } from "../../metadata";
import { StoreShell } from "../../store-shell";

type Props = { params: Promise<{ slug: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("onlineStore.track");
  // H3: la página de un pedido no se indexa (el enlace es secreto).
  return { ...(await storeMetadata(slug, t("title"))), robots: { index: false, follow: false } };
}

/** S27-04: seguimiento del pedido con la llave secreta (sin datos personales del cliente). */
export default async function OrderTrackingPage({ params }: Props) {
  const { slug, token } = await params;
  const store = await loadStore(slug);
  if (!store) notFound();
  const t = await getTranslations("onlineStore");
  const currency = store.info.currency;

  const valid = z.guid().safeParse(token).success;
  const supabase = await createClient();
  const order = valid
    ? parseOrderStatus((await supabase.rpc("store_order_status", { p_slug: slug, p_token: token })).data)
    : null;

  if (!order) {
    return (
      <StoreShell slug={slug} info={store.info}>
        <section className="flex flex-col items-center gap-3 py-12 text-center">
          <h1 className="text-xl font-semibold tracking-tight">{t("track.notFound")}</h1>
          <p className="text-sm text-muted-foreground">{t("track.notFoundText")}</p>
          <Link href={`/tienda/${slug}`} className="text-sm underline">{t("cart.keepShopping")}</Link>
        </section>
      </StoreShell>
    );
  }

  const paid = order.paymentStatus === "paid";
  return (
    <StoreShell slug={slug} info={store.info}>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("track.heading", { code: order.code })}</h1>
          <p className="text-sm text-muted-foreground">{t("track.placedOn", { date: formatDate(order.createdAt) })}</p>
        </div>

        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t("track.statusLabel")}>
          {orderTimeline(order.status).map((s) => (
            <li
              key={s.step}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                s.done ? "border-(--store) font-medium" : "border-border text-muted-foreground"
              }`}
            >
              {s.step === "cancelled" ? (
                <X className="size-4 shrink-0 text-destructive" aria-hidden="true" />
              ) : (
                <Check className={`size-4 shrink-0 ${s.done ? "" : "opacity-30"}`} aria-hidden="true" />
              )}
              {t(`track.steps.${s.step}`)}
            </li>
          ))}
        </ol>

        <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
          <ul className="flex flex-col gap-1 text-sm">
            {order.items.map((i) => (
              <li key={i.name} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{i.qty} × {i.name}</span>
                <span className="tabular-nums">{formatMoney(i.lineTotal, currency)}</span>
              </li>
            ))}
            {order.shippingCost > 0 ? (
              <li className="flex justify-between gap-3 text-muted-foreground">
                <span>{t("track.shipping")}</span>
                <span className="tabular-nums">{formatMoney(order.shippingCost, currency)}</span>
              </li>
            ) : null}
          </ul>
          <p className="flex justify-between border-t border-border pt-2 font-semibold">
            <span>{t("cart.estimatedTotal")}</span>
            <span className="tabular-nums">{formatMoney(order.total, currency)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {t(`order.deliveries.${order.delivery}`)}
            {order.payment ? ` · ${t(`order.payments.${order.payment}`)}` : ""}
          </p>
          <p className={`text-sm font-medium ${paid ? "text-success" : ""}`}>{t(`track.payment.${order.paymentStatus}`)}</p>
        </section>

        {order.canUpload && order.payment ? (
          <PaymentInstructions
            method={order.payment}
            payments={order.payments}
            code={order.code}
            total={order.total}
            currency={currency}
            token={token}
          />
        ) : null}
      </div>
    </StoreShell>
  );
}
