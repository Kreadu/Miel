import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { ProductForm } from "./product-form";
import { ProductRow } from "./product-row";

export const metadata = { title: "Productos · Miel" };

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>;
}) {
  const { active } = await getActiveTenant();
  if (!active) notFound();
  const { editar } = await searchParams;

  const canManage = active.role !== "member";

  // Siempre se consulta la vista `products_catalog`, nunca la tabla `products` directo: la
  // vista enmascara cost/price/tax_rate a null para member (spec S2-02).
  const supabase = await createClient();
  const [{ data: products }, { data: warehouses }] = await Promise.all([
    supabase
      .from("products_catalog")
      .select("id, sku, name, description, unit, kind, cost, price, tax_rate, min_stock, active")
      .order("name", { ascending: true }),
    supabase.from("warehouses").select("id, name").order("name", { ascending: true }),
  ]);

  const rows = (products ?? [])
    .filter((p): p is typeof p & { id: string } => p.id != null)
    .map((p) => ({
      id: p.id,
      sku: p.sku ?? "",
      name: p.name ?? "",
      description: p.description,
      unit: p.unit ?? "unidad",
      kind: (p.kind ?? "raw") as "raw" | "finished" | "resale",
      cost: p.cost,
      price: p.price,
      tax_rate: p.tax_rate,
      min_stock: p.min_stock ?? 0,
      active: p.active ?? true,
    }));
  const editingProduct = canManage ? rows.find((p) => p.id === editar) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Productos</h1>
        <p className="text-sm text-muted-foreground">{active.tenantName}</p>
      </div>

      {canManage ? (
        editingProduct ? (
          <ProductForm key={editingProduct.id} values={editingProduct} />
        ) : (
          <ProductForm warehouses={warehouses ?? []} />
        )
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 text-right font-medium">Precio</th>
                <th className="px-3 py-2 text-right font-medium">Stock mín.</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => (
                <ProductRow key={product.id} canManage={canManage} product={product} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {canManage
            ? "Aún no tienes productos. Crea el primero arriba."
            : "Aún no hay productos registrados."}
        </p>
      )}
    </div>
  );
}
