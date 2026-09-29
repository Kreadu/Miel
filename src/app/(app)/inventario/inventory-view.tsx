import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { CategoryFilter } from "@/components/products/category-filter";
import { CategoryManager } from "@/components/products/category-manager";
import { NewProductButton } from "@/components/products/new-product-button";
import { Button } from "@/components/ui/button";
import { type InventoryConfig, inventoryPath } from "@/lib/inventories";
import { loadProducts } from "@/lib/products/load";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { ArchivedProducts } from "./archived-products";
import { type HistoryParams, InventoryHistory } from "./inventory-history";
import { ProductGrid } from "./product-grid";

/**
 * S19-24/S19-26: pantalla de un inventario — misma vista y mismo formulario que el Catálogo
 * (crear, editar, eliminar, categorías, reactivar eliminados). La usan /inventario/productos y
 * /inventario/<tipo>. Los precios salen de `products_catalog`, que enmascara el costo a member.
 */
export async function InventoryView({
  inventory,
  categoria,
  history,
}: {
  inventory: InventoryConfig;
  categoria?: string;
  /** S19-34: filtros del Historial (`?historial=1&desde&hasta&bodega`). */
  history: HistoryParams;
}) {
  const { active } = await getActiveTenant();
  if (!active) notFound();
  const t = await getTranslations("catalog");

  const canManage = active.role !== "member";

  const supabase = await createClient();
  const [{ products, categories, warehouses }, { data: archived }] = await Promise.all([
    loadProducts(supabase, active.tenantId, inventory.id),
    canManage
      ? supabase
          .from("products_catalog")
          .select("id, sku, name")
          .eq("tenant_id", active.tenantId)
          .eq("inventory", inventory.id)
          .eq("active", false)
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);
  const rows = categoria ? products.filter((p) => p.categoryId === categoria) : products;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{inventory.title}</h1>
          <p className="text-sm text-muted-foreground">{active.tenantName}</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-start gap-2">
            <CategoryManager
              inventory={inventory.id}
              categories={categories}
              trigger={<Button variant="outline">{t("generateCategories")}</Button>}
            />
            <NewProductButton
              mode="inventory"
              warehouses={warehouses}
              inventory={inventory.id}
              label={inventory.addLabel}
              categories={categories}
            />
          </div>
        ) : null}
      </div>

      <InventoryHistory
        inventory={inventory}
        basePath={inventoryPath(inventory)}
        warehouses={warehouses}
        currency={active.currency}
        params={history}
      />

      <CategoryFilter
        categories={categories}
        current={categoria}
        basePath={inventoryPath(inventory)}
        allLabel={t("all")}
      />

      {rows.length > 0 ? (
        <ProductGrid
          products={rows}
          canManage={canManage}
          categories={categories}
          warehouses={warehouses}
          currency={active.currency}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {categoria
            ? t("emptyCategory")
            : canManage
              ? `Aún no hay nada en este inventario. Usa "${inventory.addLabel}".`
              : "Aún no hay nada en este inventario."}
        </p>
      )}

      <ArchivedProducts
        products={(archived ?? []).filter((p): p is typeof p & { id: string } => p.id != null)}
      />
    </div>
  );
}
