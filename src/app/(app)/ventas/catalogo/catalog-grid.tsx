"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { useCatalogCart } from "../use-catalog-cart";
import { CatalogCard, type CatalogProduct } from "./catalog-card";
import { CurrencySelector } from "./currency-selector";

export function CatalogGrid({
  products,
  canManage,
  baseCurrency,
  tenantId,
  categories,
}: {
  products: CatalogProduct[];
  canManage: boolean;
  baseCurrency: string;
  tenantId: string;
  categories: { id: string; name: string }[];
}) {
  const [displayCurrency, setDisplayCurrency] = useState(baseCurrency);
  const [rate, setRate] = useState(1);
  const { lines, addItem } = useCatalogCart(tenantId);

  // Solo agrega al carrito — el humano pidió explícitamente quedarse viendo el catálogo y
  // navegar a Pedidos cuando él elija, con el botón "Ver pedido" (no automático por producto).
  function handleAddToCart(product: CatalogProduct) {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      discountPercent: product.discountPercent,
      taxRate: product.taxRate,
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
            <Link href="/ventas/pedidos">Ver pedido ({cartCount})</Link>
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <CatalogCard
            key={product.id}
            product={product}
            canManage={canManage}
            displayCurrency={displayCurrency}
            rate={rate}
            onAddToCart={() => handleAddToCart(product)}
            categories={categories}
          />
        ))}
      </div>
    </div>
  );
}
