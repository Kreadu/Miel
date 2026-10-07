"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";

import { placeStoreOrder } from "@/actions/store-order";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/currency";
import { cartTotal, MAX_QTY, setCartQty } from "@/lib/store/cart";
import type { StoreProduct } from "@/lib/store/load";
import { storePrice } from "@/lib/store/price";
import { whatsappUrl } from "@/lib/purchases/whatsapp";

import { useCart } from "../use-cart";

const PAYMENTS = ["nequi", "daviplata", "transfer", "cash_on_delivery", "in_store"] as const;
const BUTTON =
  "flex h-11 w-full items-center justify-center rounded-md bg-(--store) px-4 text-sm font-semibold text-(--store-fg) transition-opacity hover:opacity-90 disabled:opacity-50";

/** S27-02: carrito y formulario del pedido como invitado. */
export function CartView({
  slug,
  products,
  currency,
  storeName,
  storePhone,
}: {
  slug: string;
  products: StoreProduct[];
  currency: string;
  storeName: string;
  storePhone: string | null;
}) {
  const t = useTranslations("onlineStore");
  const { cart, update } = useCart(slug);
  const [state, action, pending] = useActionState(placeStoreOrder, null);
  const [delivery, setDelivery] = useState<"pickup" | "delivery">("pickup");
  const [payment, setPayment] = useState<(typeof PAYMENTS)[number]>("nequi");

  // Pedido hecho: el carrito queda vacío (el resumen lo muestra la respuesta).
  useEffect(() => {
    if (state?.ok) update(() => ({}));
  }, [state, update]);

  if (state?.ok) {
    const message = t("order.whatsappText", { code: state.code, name: storeName });
    return (
      <section className="mx-auto flex max-w-md flex-col items-center gap-3 py-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{t("order.successTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("order.successText", { name: storeName })}</p>
        <p className="rounded-lg border border-border bg-card px-4 py-3">
          <span className="block text-xs text-muted-foreground">{t("order.code")}</span>
          <span className="text-lg font-semibold tabular-nums">#{state.code}</span>
          <span className="block text-sm tabular-nums">{t("order.total", { total: formatMoney(state.total, currency) })}</span>
        </p>
        {storePhone ? (
          <div className="flex w-full flex-col gap-2">
            <a className={BUTTON} href={whatsappUrl(storePhone, message)} target="_blank" rel="noopener">
              {t("order.writeWhatsapp")}
            </a>
            <a className="text-sm underline" href={`tel:${storePhone}`}>
              {t("order.call", { phone: storePhone })}
            </a>
          </div>
        ) : null}
        <Link href={`/tienda/${slug}`} className="text-sm underline">
          {t("cart.keepShopping")}
        </Link>
      </section>
    );
  }

  const lines = products.filter((p) => cart[p.product_id]);
  const missing = Object.keys(cart).filter((id) => !products.some((p) => p.product_id === id));
  const items = lines.map((p) => ({ product_id: p.product_id, qty: cart[p.product_id] }));

  if (lines.length === 0) {
    return (
      <section className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-muted-foreground">{t("cart.empty")}</p>
        <Link href={`/tienda/${slug}`} className="text-sm underline">
          {t("cart.keepShopping")}
        </Link>
      </section>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_24rem]">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t("cart.title")}</h1>
        {missing.length > 0 ? (
          <p className="text-sm text-muted-foreground">{t("cart.someGone")}</p>
        ) : null}
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {lines.map((p) => {
            const qty = cart[p.product_id];
            const unit = storePrice(Number(p.price), Number(p.discount_percent), Number(p.tax_rate)).final;
            return (
              <li key={p.product_id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{formatMoney(unit, currency)}</p>
                  {!p.available ? <p className="text-xs text-destructive">{t("soldOut")}</p> : null}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={t("cart.less", { name: p.name })}
                    onClick={() => update((c) => setCartQty(c, p.product_id, qty - 1))}
                    className="flex size-10 items-center justify-center rounded-md border border-border hover:bg-muted"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">{qty}</span>
                  <button
                    type="button"
                    aria-label={t("cart.more", { name: p.name })}
                    disabled={qty >= MAX_QTY}
                    onClick={() => update((c) => setCartQty(c, p.product_id, qty + 1))}
                    className="flex size-10 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-50"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("cart.remove", { name: p.name })}
                    onClick={() => update((c) => setCartQty(c, p.product_id, 0))}
                    className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <span className="w-24 text-right text-sm font-medium tabular-nums">{formatMoney(unit * qty, currency)}</span>
              </li>
            );
          })}
        </ul>
        <p className="flex justify-between text-base font-semibold">
          <span>{t("cart.estimatedTotal")}</span>
          <span className="tabular-nums">{formatMoney(cartTotal(cart, products), currency)}</span>
        </p>
        <p className="text-xs text-muted-foreground">{t("cart.totalNote")}</p>
      </section>

      <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
        <h2 className="text-base font-semibold tracking-tight">{t("order.title")}</h2>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="items" value={JSON.stringify(items)} />
        {/* Campo trampa (anti-bots): oculto para personas y lectores de pantalla. */}
        <div aria-hidden="true" className="hidden">
          <label>
            Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="order-name">{t("order.name")}</Label>
          <Input id="order-name" name="name" required maxLength={80} autoComplete="name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="order-phone">{t("order.phone")}</Label>
          <Input id="order-phone" name="phone" type="tel" required maxLength={20} autoComplete="tel" inputMode="tel" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="order-email">{t("order.email")}</Label>
          <Input id="order-email" name="email" type="email" maxLength={160} autoComplete="email" />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("order.delivery")}</legend>
          {(["pickup", "delivery"] as const).map((d) => (
            <label key={d} className="flex min-h-10 items-center gap-2 text-sm">
              <input
                type="radio"
                name="delivery"
                value={d}
                checked={delivery === d}
                onChange={() => {
                  setDelivery(d);
                  if (d === "delivery" && payment === "in_store") setPayment("nequi");
                }}
                className="h-4 w-4 accent-(--store)"
              />
              {t(`order.deliveries.${d}`)}
            </label>
          ))}
        </fieldset>
        {delivery === "delivery" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="order-address">{t("order.address")}</Label>
            <Input id="order-address" name="address" required maxLength={200} autoComplete="street-address" />
            <p className="text-xs text-muted-foreground">{t("order.shippingNote")}</p>
          </div>
        ) : null}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("order.payment")}</legend>
          {PAYMENTS.filter((p) => p !== "in_store" || delivery === "pickup").map((p) => (
            <label key={p} className="flex min-h-10 items-center gap-2 text-sm">
              <input
                type="radio"
                name="payment"
                value={p}
                checked={payment === p}
                onChange={() => setPayment(p)}
                className="h-4 w-4 accent-(--store)"
              />
              {t(`order.payments.${p}`)}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="order-note">{t("order.note")}</Label>
          <textarea
            id="order-note"
            name="note"
            maxLength={500}
            rows={2}
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {state && !state.ok ? (
          <p role="alert" className="text-sm text-destructive">
            {t(state.error.replace(/^onlineStore\./, ""), { product: state.product ?? "" })}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className={BUTTON}>
          {pending ? t("order.sending") : t("order.submit")}
        </button>
      </form>
    </div>
  );
}
