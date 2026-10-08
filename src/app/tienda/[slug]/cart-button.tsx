"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { cartCount } from "@/lib/store/cart";

import { useCart } from "./use-cart";

/** S27-02: acceso al carrito con el número de unidades; junto al buscador, con el color de la tienda. */
export function CartButton({ slug }: { slug: string }) {
  const t = useTranslations("onlineStore.cart");
  const { cart } = useCart(slug);
  const count = cartCount(cart);
  return (
    <Link
      href={`/tienda/${slug}/carrito`}
      aria-label={t("open", { count })}
      className="relative inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-(--store) px-4 text-sm font-medium text-(--store-fg) shadow-xs transition-opacity hover:opacity-90"
    >
      <ShoppingCart className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">{t("title")}</span>
      <span className="flex min-w-5 items-center justify-center rounded-full bg-(--store-fg) px-1.5 text-xs font-semibold text-(--store) tabular-nums">
        {count}
      </span>
    </Link>
  );
}
