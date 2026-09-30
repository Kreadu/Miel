"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ProductCard } from "@/components/products/product-card";
import type { Category, ProductView, Warehouse } from "@/components/products/types";
import { Button } from "@/components/ui/button";

import { useCatalogCart } from "../use-catalog-cart";
import { CurrencySelector } from "./currency-selector";

export function CatalogGrid({
  products,
  canManage,
  baseCurrency,
  tenantId,
  categories,
  warehouses,
}: {
  products: ProductView[];
  warehouses: Warehouse[];
  canManage: boolean;
  baseCurrency: string;
  tenantId: string;
  categories: Category[];
}) {
  const [displayCurrency, setDisplayCurrency] = useState(baseCurrency);
  const [rate, setRate] = useState(1);
  const { lines, addItem } = useCatalogCart(tenantId);
  const t = useTranslations("catalog");

  // Solo agrega al carrito — el humano pidió explícitamente quedarse viendo el catálogo y
  // navegar a Pedidos cuando él elija, con el botón "Ver pedido" (no automático por producto).
  function handleAddToCart(product: ProductView) {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      discountPercent: product.discountPercent,
      taxRate: product.taxRate,
      weightKg: product.weightKg,
    });
  }

  const cartCount = lines.reduce((sum, l) => sum + l.qty, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CurrencySelector
          baseCurrency={baseCurrency}
          onChange={(currency, newRate) => {
            setDisplayCurrency(currency);
            setRate(newRate);
          }}
        />
        {cartCount > 0 ? (
          <Button asChild size="sm">
            <Link href="/ventas/pedidos">{t("viewOrder", { count: cartCount })}</Link>
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            mode="sales"
            warehouses={warehouses}
            product={product}
            canManage={canManage}
            categories={categories}
            displayCurrency={displayCurrency}
            rate={rate}
            onAddToCart={() => handleAddToCart(product)}
          />
        ))}
      </div>
    </div>
  );
}
