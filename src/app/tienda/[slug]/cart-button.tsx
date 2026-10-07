"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { cartCount } from "@/lib/store/cart";

import { useCart } from "./use-cart";

/** S27-02: acceso al carrito con el número de unidades. */
export function CartButton({ slug }: { slug: string }) {
  const t = useTranslations("onlineStore.cart");
  const { cart } = useCart(slug);
  const count = cartCount(cart);
  return (
    <Link
      href={`/tienda/${slug}/carrito`}
      aria-label={t("open", { count })}
      className="relative flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-muted"
    >
      <ShoppingBag className="size-5" aria-hidden="true" />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-(--store) px-1 text-xs font-semibold text-(--store-fg) tabular-nums">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
