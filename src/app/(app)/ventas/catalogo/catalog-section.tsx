import { getTranslations } from "next-intl/server";

import { CategoryFilter } from "@/components/products/category-filter";
import { CategoryManager } from "@/components/products/category-manager";
import { NewProductButton } from "@/components/products/new-product-button";
import { Button } from "@/components/ui/button";
import { loadProducts } from "@/lib/products/load";
import { createClient } from "@/lib/supabase/server";
import type { ActiveTenant } from "@/lib/tenant/server";

import { CatalogGrid } from "./catalog-grid";

/**
 * S19-41: sección "Catálogo" de la página Vender (antes /ventas/catalogo). S19-24/S19-26: muestra
 * el Inventario de productos (lo que se vende); no filtra por canal (eso aplica en Pedidos).
 */
export async function CatalogSection({ active, categoria }: { active: ActiveTenant; categoria?: string }) {
  const t = await getTranslations("catalog");
  const canManage = active.role !== "member";

  const supabase = await createClient();
  const { products, categories, warehouses } = await loadProducts(supabase, active.tenantId, "productos");
  const rows = categoria ? products.filter((p) => p.categoryId === categoria) : products;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
        {canManage ? (
          <div className="flex flex-wrap items-start gap-2">
            <CategoryManager
              inventory="productos"
              categories={categories}
              trigger={<Button variant="outline">{t("generateCategories")}</Button>}
            />
            <NewProductButton
              mode="sales"
              warehouses={warehouses}
              inventory="productos"
              label={t("generateProduct")}
              categories={categories}
            />
          </div>
        ) : null}
      </div>

      <CategoryFilter categories={categories} current={categoria} basePath="/ventas" allLabel={t("all")} />

      {rows.length > 0 ? (
        <CatalogGrid
          products={rows}
          canManage={canManage}
          baseCurrency={active.currency}
          tenantId={active.tenantId}
          categories={categories}
          warehouses={warehouses}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {categoria ? t("emptyCategory") : canManage ? t("emptyManage") : t("emptyPublic")}
        </p>
      )}
    </section>
  );
}
