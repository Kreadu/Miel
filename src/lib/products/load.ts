import type { Category, ProductKind, ProductView, SalesChannel } from "@/components/products/types";
import { stockByProduct } from "@/lib/stock";
import type { createClient } from "@/lib/supabase/server";

/**
 * S19-24: carga compartida de Productos (inventario) y Catálogo (vender): mismos productos,
 * stock por bodega o sucursal y categorías. `sellableOnly` deja afuera la materia prima
 * (el catálogo solo muestra lo que se vende: terminado y reventa).
 */
export async function loadProducts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  { sellableOnly }: { sellableOnly: boolean },
): Promise<{ products: ProductView[]; categories: Category[] }> {
  let productsQuery = supabase
    .from("products_catalog")
    .select(
      "id, sku, name, description, unit, kind, cost, price, tax_rate, min_stock, discount_percent, sales_channel, category_id, photo_url",
    )
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("name", { ascending: true });
  if (sellableOnly) productsQuery = productsQuery.in("kind", ["finished", "resale"]);

  const [{ data: products, error }, { data: stockRows }, { data: warehouses }, { data: categories }] =
    await Promise.all([
      productsQuery,
      supabase
        .from("current_stock")
        .select("product_id, warehouse_id, total_qty")
        .eq("tenant_id", tenantId),
      supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId),
      supabase
        .from("product_categories")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true }),
    ]);
  if (error) throw error;

  const stock = stockByProduct(stockRows ?? [], new Map((warehouses ?? []).map((w) => [w.id, w.name])));
  const categoryList = categories ?? [];
  const categoryNameById = new Map(categoryList.map((c) => [c.id, c.name]));

  return {
    categories: categoryList,
    products: (products ?? [])
      .filter((p): p is typeof p & { id: string; name: string } => p.id != null && p.name != null)
      .map((p) => ({
        id: p.id,
        sku: p.sku ?? "",
        name: p.name,
        description: p.description,
        unit: p.unit ?? "unidad",
        kind: (p.kind ?? "resale") as ProductKind,
        cost: p.cost,
        price: p.price ?? 0,
        taxRate: p.tax_rate ?? 0,
        minStock: p.min_stock ?? 0,
        discountPercent: p.discount_percent ?? 0,
        salesChannel: (p.sales_channel ?? "both") as SalesChannel,
        categoryId: p.category_id,
        categoryName: p.category_id ? (categoryNameById.get(p.category_id) ?? null) : null,
        photoUrl: p.photo_url,
        stock: stock.get(p.id) ?? [],
      })),
  };
}
