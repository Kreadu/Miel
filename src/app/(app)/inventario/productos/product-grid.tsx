"use client";

import { ProductCard } from "@/components/products/product-card";
import type { Category, ProductView } from "@/components/products/types";

/** S19-24: misma tarjeta que el Catálogo, sin carrito ni conversión de moneda. */
export function ProductGrid({
  products,
  canManage,
  categories,
  currency,
}: {
  products: ProductView[];
  canManage: boolean;
  categories: Category[];
  currency: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          canManage={canManage}
          categories={categories}
          displayCurrency={currency}
        />
      ))}
    </div>
  );
}
