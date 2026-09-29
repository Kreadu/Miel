import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { CatalogGrid } from "./catalog-grid";
import { CatalogProductForm } from "./catalog-product-form";
import { CategoryManager } from "./category-manager";

export const metadata = { title: "Catálogo · Miel" };

export default async function CatalogoPage({
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
  // Corrección post-S19-05: esta página es la vista de GESTIÓN del catálogo (crear/editar/
  // eliminar), no el escaparate público — filtrar por canal acá escondía productos "solo tienda"
  // del único lugar donde se administran. El filtro por canal aplica donde sí importa
  // operativamente: /ventas/pos y /ventas/pedidos (canal físico).
  const [{ data: products, error }, { data: stockRows }, { data: warehouses }, { data: categories }] =
    await Promise.all([
      supabase
        .from("products_catalog")
        .select(
          "id, name, description, price, discount_percent, photo_url, sales_channel, tax_rate, category_id",
        )
        .eq("tenant_id", active.tenantId)
        .eq("active", true)
        .order("name", { ascending: true }),
      // S19-13: current_stock (vista de stock_movements, S2-03) ya agrupa cantidad por
      // producto+bodega — no hace falta esquema nuevo, solo consultarla desde el catálogo.
      supabase
        .from("current_stock")
        .select("product_id, warehouse_id, total_qty")
        .eq("tenant_id", active.tenantId),
      supabase.from("warehouses").select("id, name").eq("tenant_id", active.tenantId),
      // S19-15: categorías del tenant, para el selector del formulario y los botones de filtro.
      supabase
        .from("product_categories")
        .select("id, name")
        .eq("tenant_id", active.tenantId)
        .order("name", { ascending: true }),
    ]);
  if (error) throw error;

  const warehouseNameById = new Map((warehouses ?? []).map((w) => [w.id, w.name]));
  const stockByProduct = new Map<string, { warehouseName: string; qty: number }[]>();
  for (const row of stockRows ?? []) {
    if (!row.product_id || !row.warehouse_id) continue;
    const warehouseName = warehouseNameById.get(row.warehouse_id) ?? "—";
    const qty = row.total_qty ?? 0;
    const existing = stockByProduct.get(row.product_id) ?? [];
    existing.push({ warehouseName, qty });
    stockByProduct.set(row.product_id, existing);
  }

  const categoryList = categories ?? [];
  const categoryNameById = new Map(categoryList.map((c) => [c.id, c.name]));

  const allRows = (products ?? [])
    .filter((p): p is typeof p & { id: string; name: string } => p.id != null && p.name != null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price ?? 0,
      discountPercent: p.discount_percent ?? 0,
      photoUrl: p.photo_url,
      salesChannel: (p.sales_channel ?? "both") as "online" | "in_store" | "both",
      taxRate: p.tax_rate ?? 0,
      stock: stockByProduct.get(p.id) ?? [],
      categoryId: p.category_id,
      categoryName: p.category_id ? (categoryNameById.get(p.category_id) ?? null) : null,
    }));

  // S19-15: filtro server-side por ?categoria=<id> — "Todos" es la ausencia del parámetro.
  const rows = categoria ? allRows.filter((p) => p.categoryId === categoria) : allRows;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{active.tenantName}</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-start gap-2">
            <CategoryManager
              categories={categoryList}
              trigger={<Button variant="outline">{t("categories")}</Button>}
            />
            <CatalogProductForm categories={categoryList} />
          </div>
        ) : null}
      </div>

      {categoryList.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/ventas/catalogo"
            className={`inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-medium ${
              !categoria
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {t("all")}
          </Link>
          {categoryList.map((c) => (
            <Link
              key={c.id}
              href={`/ventas/catalogo?categoria=${c.id}`}
              className={`inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-medium ${
                categoria === c.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <CatalogGrid
          products={rows}
          canManage={canManage}
          baseCurrency={active.currency}
          tenantId={active.tenantId}
          categories={categoryList}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {categoria
            ? t("emptyCategory")
            : canManage
              ? t("emptyManage")
              : t("emptyPublic")}
        </p>
      )}
    </div>
  );
}
