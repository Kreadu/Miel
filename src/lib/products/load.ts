import type {
  Category,
  ProductKind,
  ProductView,
  SalesChannel,
  Warehouse,
} from "@/components/products/types";
import type { InventoryId } from "@/lib/inventories";
import { stockByProduct } from "@/lib/stock";
import type { createClient } from "@/lib/supabase/server";

/**
 * S19-24/S19-26: carga compartida de cada inventario y del Catálogo (que usa el inventario
 * "productos"): ítems activos, stock por bodega o sucursal y categorías.
 */
export async function loadProducts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  inventory: InventoryId,
): Promise<{ products: ProductView[]; categories: Category[]; warehouses: Warehouse[] }> {
  const productsQuery = supabase
    .from("products_catalog")
    .select(
      "id, sku, name, description, unit, kind, cost, price, tax_rate, min_stock, discount_percent, sales_channel, category_id, photo_url, inventory, plate, brand, model, color, serial_number, vehicle_year, purchase_date, weight_kg",
    )
    .eq("tenant_id", tenantId)
    .eq("inventory", inventory)
    .eq("active", true)
    .order("name", { ascending: true });

  const [{ data: products, error }, { data: stockRows }, { data: warehouses }, { data: categories }] =
    await Promise.all([
      productsQuery,
      supabase
        .from("current_stock")
        .select("product_id, warehouse_id, total_qty")
        .eq("tenant_id", tenantId),
      supabase
        .from("warehouses")
        .select("id, name, active")
        .eq("tenant_id", tenantId)
        .order("is_default", { ascending: false })
        .order("name", { ascending: true }),
      supabase
        .from("product_categories")
        .select("id, name")
        .eq("tenant_id", tenantId)
        // S19-28: cada inventario solo ve sus propias categorías.
        .eq("inventory", inventory)
        .order("name", { ascending: true }),
    ]);
  if (error) throw error;

  const stock = stockByProduct(stockRows ?? [], new Map((warehouses ?? []).map((w) => [w.id, w.name])));
  const categoryList = categories ?? [];
  const categoryNameById = new Map(categoryList.map((c) => [c.id, c.name]));

  return {
    categories: categoryList,
    // S19-32: bodegas o sucursales activas, para mostrar/editar el stock de cada una.
    warehouses: (warehouses ?? []).filter((w) => w.active).map((w) => ({ id: w.id, name: w.name })),
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
        inventory,
        plate: p.plate,
        brand: p.brand,
        model: p.model,
        color: p.color,
        serialNumber: p.serial_number,
        vehicleYear: p.vehicle_year,
        purchaseDate: p.purchase_date,
        weightKg: p.weight_kg ?? 0,
      })),
  };
}
