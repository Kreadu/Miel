"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/currency";
import type { StoreProduct } from "@/lib/store/load";
import { addToCart, MAX_QTY } from "@/lib/store/cart";
import { storePrice } from "@/lib/store/price";

import { useCart } from "./use-cart";

// ponytail: filtra en el cliente; paginar en la BD cuando una tienda pase de ~500 productos.
export function StoreCatalog({
  slug,
  products,
  currency,
  place,
}: {
  slug: string;
  products: StoreProduct[];
  currency: string;
  /** Dirección de la tienda física (para los productos que solo se venden ahí, S27-08). */
  place: string;
}) {
  const t = useTranslations("onlineStore");
  const { cart, update } = useCart(slug);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter((c): c is string => !!c))].sort(),
    [products],
  );
  const q = query.trim().toLowerCase();
  const visible = products.filter(
    (p) =>
      (!category || p.category === category) &&
      (!q || p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)),
  );

  if (products.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("search")}
        aria-label={t("search")}
        className="max-w-md"
      />
      {categories.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t("categories")}>
          {[null, ...categories].map((c) => (
            <button
              key={c ?? "all"}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={`h-9 shrink-0 rounded-full border px-4 text-sm transition-colors ${
                category === c
                  ? "border-(--store) bg-(--store) text-(--store-fg)"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              {c ?? t("all")}
            </button>
          ))}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{t("noResults")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {visible.map((p) => {
            const price = storePrice(Number(p.price), Number(p.discount_percent), Number(p.tax_rate));
            // S27-08: solo en la tienda física — se muestra como publicidad, no se pide por la web.
            const inStore = p.sales_channel === "in_store";
            return (
              <li key={p.product_id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                <div className="relative aspect-square bg-muted">
                  {p.photo_url ? (
                    <Image src={p.photo_url} alt={p.name} fill unoptimized className="object-cover" />
                  ) : (
                    <span aria-hidden="true" className="flex h-full items-center justify-center text-3xl font-semibold text-muted-foreground">
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  {!p.available && !inStore ? (
                    <span className="absolute left-2 top-2 rounded-md bg-background/90 px-2 py-0.5 text-xs font-medium">
                      {t("soldOut")}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <h2 className="line-clamp-2 text-sm font-medium">{p.name}</h2>
                  {p.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p> : null}
                  <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-1">
                    <span className="text-base font-semibold tabular-nums">{formatMoney(price.final, currency)}</span>
                    {price.before ? (
                      <span className="text-xs text-muted-foreground tabular-nums line-through">{formatMoney(price.before, currency)}</span>
                    ) : null}
                  </div>
                  {inStore ? (
                    <p className="mt-1 rounded-md bg-muted px-2 py-1.5 text-xs">
                      <span className="font-medium">{t("inStoreOnly")}</span>
                      {place ? <span className="block text-muted-foreground">{place}</span> : null}
                    </p>
                  ) : (
                    <span className={`text-xs ${p.available ? "text-success" : "text-muted-foreground"}`}>
                      {p.available ? t("available") : t("soldOut")}
                    </span>
                  )}
                  {p.available && !inStore ? (
                    <button
                      type="button"
                      disabled={(cart[p.product_id] ?? 0) >= MAX_QTY}
                      onClick={() => update((c) => addToCart(c, p.product_id))}
                      className="mt-2 h-10 rounded-md bg-(--store) px-3 text-sm font-medium text-(--store-fg) transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {cart[p.product_id] ? t("cart.addMore", { qty: cart[p.product_id] }) : t("cart.add")}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
