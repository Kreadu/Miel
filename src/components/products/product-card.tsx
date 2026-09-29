"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { toggleProductActive } from "@/actions/products";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";

import { ProductEditor } from "./product-editor";
import type { Category, ProductView } from "./types";

/**
 * S19-24: tarjeta de producto compartida por Catálogo y Productos (inventario). Editar abre el
 * mismo formulario único. `onAddToCart` solo en el Catálogo (armar pedido).
 */
export function ProductCard({
  product,
  canManage,
  categories,
  displayCurrency,
  rate = 1,
  onAddToCart,
}: {
  product: ProductView;
  canManage: boolean;
  categories: Category[];
  displayCurrency: string;
  rate?: number;
  onAddToCart?: () => void;
}) {
  const t = useTranslations("catalog");
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ProductEditor product={product} categories={categories} onDone={() => setEditing(false)} />
    );
  }

  const channelBadge = { online: t("onlineOnly"), in_store: t("inStoreOnly"), both: null }[
    product.salesChannel
  ];
  const kindLabel = { raw: t("kindRaw"), finished: t("kindFinished"), resale: t("kindResale") }[
    product.kind
  ];
  const finalPrice =
    (product.discountPercent > 0 ? product.price * (1 - product.discountPercent / 100) : product.price) *
    rate;
  const totalStock = product.stock.reduce((sum, s) => sum + s.qty, 0);

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
          {channelBadge ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {channelBadge}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {product.sku} · {kindLabel}
        </p>
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
                {formatMoney(product.price * rate, displayCurrency)}
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
          {onAddToCart ? (
            <Button type="button" size="sm" onClick={onAddToCart}>
              {t("addToOrder")}
            </Button>
          ) : null}
          {canManage ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
                {t("edit")}
              </Button>
              {product.kind === "finished" ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/inventario/productos/${product.id}/receta`}>{t("recipe")}</Link>
                </Button>
              ) : null}
              {/* Borrado lógico: se puede reactivar desde Productos → "Productos eliminados". */}
              <form
                action={toggleProductActive}
                onSubmit={(e) => {
                  if (!confirm(`¿Eliminar "${product.name}"?`)) e.preventDefault();
                }}
              >
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
