"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { toggleProductActive } from "@/actions/products";
import { updateCatalogProduct } from "@/actions/catalog";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";

import { CatalogProductFields } from "./catalog-product-fields";

export type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discountPercent: number;
  photoUrl: string | null;
  salesChannel: "online" | "in_store" | "both";
  taxRate: number;
  stock: { warehouseName: string; qty: number }[];
  categoryId: string | null;
  categoryName: string | null;
};

export function CatalogCard({
  product,
  canManage,
  displayCurrency,
  rate,
  onAddToCart,
  warehouses,
  categories,
}: {
  product: CatalogProduct;
  canManage: boolean;
  displayCurrency: string;
  rate: number;
  /** S19-06: agrega este producto al carrito (moneda base, no la convertida) y navega al pedido. */
  onAddToCart: () => void;
  warehouses: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}) {
  const t = useTranslations("catalog");
  const channelBadge: Record<CatalogProduct["salesChannel"], string | null> = {
    online: t("onlineOnly"),
    in_store: t("inStoreOnly"),
    both: null,
  };
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateCatalogProduct, null);

  // Ajuste de estado durante el render (mismo patrón que WarehouseRow/CatalogProductForm).
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setEditing(false);
  }

  const finalPrice =
    (product.discountPercent > 0 ? product.price * (1 - product.discountPercent / 100) : product.price) *
    rate;
  const basePriceConverted = product.price * rate;
  const totalStock = product.stock.reduce((sum, s) => sum + s.qty, 0);

  if (editing) {
    return (
      <form
        action={formAction}
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs"
      >
        <input type="hidden" name="id" value={product.id} />
        <CatalogProductFields
          defaultName={product.name}
          defaultDescription={product.description}
          defaultPrice={product.price}
          defaultDiscountPercent={product.discountPercent}
          defaultSalesChannel={product.salesChannel}
          defaultCategoryId={product.categoryId}
          isEditing
          warehouses={warehouses}
          categories={categories}
        />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {t("save")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            {t("cancel")}
          </Button>
        </div>
        {state && !state.ok ? (
          <p role="alert" className="text-xs text-destructive">
            {state.error}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <div className="relative aspect-square w-full bg-muted">
        {product.photoUrl ? (
          <Image src={product.photoUrl} alt={product.name} fill unoptimized className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {t("noPhoto")}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{product.name}</p>
          {channelBadge[product.salesChannel] ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {channelBadge[product.salesChannel]}
            </span>
          ) : null}
        </div>
        {product.categoryName ? (
          <span className="w-fit rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
            {product.categoryName}
          </span>
        ) : null}
        {product.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
        ) : null}
        <div className="mt-1 flex items-center gap-2">
          {product.discountPercent > 0 ? (
            <>
              <span className="text-xs text-muted-foreground line-through">
                {formatMoney(basePriceConverted, displayCurrency)}
              </span>
              <span className="text-sm font-semibold text-primary">
                {formatMoney(finalPrice, displayCurrency)}
              </span>
            </>
          ) : (
            <span className="text-sm font-semibold">{formatMoney(finalPrice, displayCurrency)}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {product.stock.length > 0 ? (
            <>
              {t("stock")}: {totalStock.toLocaleString("es-CO")} (
              {product.stock.map((s) => `${s.warehouseName}: ${s.qty.toLocaleString("es-CO")}`).join(" · ")}
              )
            </>
          ) : (
            t("noStockRegistered")
          )}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <Button type="button" size="sm" onClick={onAddToCart}>
            {t("addToOrder")}
          </Button>
          {canManage ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
                {t("edit")}
              </Button>
              <form action={toggleProductActive}>
                <input type="hidden" name="id" value={product.id} />
                <input type="hidden" name="active" value="false" />
                <Button type="submit" variant="ghost" size="sm">
                  {t("delete")}
                </Button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
