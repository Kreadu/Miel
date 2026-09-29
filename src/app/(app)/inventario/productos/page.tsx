import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { CategoryFilter } from "@/components/products/category-filter";
import { CategoryManager } from "@/components/products/category-manager";
import { NewProductButton } from "@/components/products/new-product-button";
import { Button } from "@/components/ui/button";
import { loadProducts } from "@/lib/products/load";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { ArchivedProducts } from "./archived-products";
import { ProductGrid } from "./product-grid";

export const metadata = { title: "Productos · Miel" };

/**
 * S19-24: Productos de inventario = misma vista y mismo formulario que el Catálogo de vender,
 * con todos los productos (también materia prima). Los precios salen de `products_catalog`,
 * que enmascara el costo para member.
 */
export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { active } = await getActiveTenant();
  if (!active) notFound();
  const { categoria } = await searchParams;
  const t = await getTranslations("catalog");

  const canManage = active.role !== "member";

  const supabase = await createClient();
  const [{ products, categories }, { data: archived }] = await Promise.all([
    loadProducts(supabase, active.tenantId, { sellableOnly: false }),
    // S19-25: eliminados (borrado lógico), para poder reactivarlos.
    canManage
      ? supabase
          .from("products_catalog")
          .select("id, sku, name")
          .eq("tenant_id", active.tenantId)
          .eq("active", false)
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);
  const rows = categoria ? products.filter((p) => p.categoryId === categoria) : products;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("products")}</h1>
          <p className="text-sm text-muted-foreground">{active.tenantName}</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-start gap-2">
            <CategoryManager
              categories={categories}
              trigger={<Button variant="outline">{t("generateCategories")}</Button>}
            />
            <NewProductButton label={t("generateProduct")} categories={categories} />
          </div>
        ) : null}
      </div>

      <CategoryFilter
        categories={categories}
        current={categoria}
        basePath="/inventario/productos"
        allLabel={t("all")}
      />

      {rows.length > 0 ? (
        <ProductGrid
          products={rows}
          canManage={canManage}
          categories={categories}
          currency={active.currency}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {categoria ? t("emptyCategory") : canManage ? t("emptyManage") : t("emptyPublic")}
        </p>
      )}

      <ArchivedProducts
        products={(archived ?? []).filter((p): p is typeof p & { id: string } => p.id != null)}
      />
    </div>
  );
}
