import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { PurchaseForm } from "./purchase-form";
import { PurchaseRow } from "./purchase-row";

export const metadata = { title: "Órdenes de compra · Miel" };

export default async function OrdenesCompraPage({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>;
}) {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const canManage = active.role !== "member";
  const { editar } = await searchParams;

  const supabase = await createClient();
  const [purchasesRes, suppliersRes, productsRes, warehousesRes, supplierProductsRes] =
    await Promise.all([
      supabase
        .from("purchases")
        .select(
          "id, status, total, issued_at, created_at, note, supplier_id, suppliers(name), purchase_items(id, qty, unit_cost, tax_rate, product_id, products(sku, name))",
        )
        .order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
      supabase
        .from("products_catalog")
        .select("id, sku, name, cost, tax_rate")
        .eq("active", true)
        .order("name"),
      supabase.from("warehouses").select("id, name").eq("active", true).order("name"),
      supabase.from("supplier_products").select("supplier_id, product_id"),
    ]);

  const purchases = purchasesRes.data ?? [];
  const suppliers = suppliersRes.data ?? [];
  const products = (productsRes.data ?? []).filter((p) => p.id) as {
    id: string;
    sku: string;
    name: string;
    cost: number | null;
    tax_rate: number | null;
  }[];
  const warehouses = warehousesRes.data ?? [];

  // Sugeridos por proveedor para el selector de producto (S15-01): agrupa en servidor,
  // sin refetch al cambiar de proveedor en el cliente.
  const suggestedBySupplier: Record<string, string[]> = {};
  for (const sp of supplierProductsRes.data ?? []) {
    (suggestedBySupplier[sp.supplier_id] ??= []).push(sp.product_id);
  }

  const editingPurchase = canManage ? purchases.find((p) => p.id === editar) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Órdenes de compra</h1>
        <p className="text-sm text-muted-foreground">{active.tenantName}</p>
      </div>

      {canManage ? (
        editingPurchase ? (
          <PurchaseForm
            suppliers={suppliers}
            products={products}
            suggestedBySupplier={suggestedBySupplier}
            purchase={{
              id: editingPurchase.id,
              supplier_id: editingPurchase.supplier_id,
              note: editingPurchase.note ?? "",
              items: editingPurchase.purchase_items.map((it) => ({
                product_id: it.product_id,
                qty: String(it.qty),
                unit_cost: String(it.unit_cost),
                tax_rate: String(it.tax_rate),
              })),
            }}
          />
        ) : (
          <PurchaseForm
            suppliers={suppliers}
            products={products}
            suggestedBySupplier={suggestedBySupplier}
          />
        )
      ) : null}

      {purchases.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Proveedor</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <PurchaseRow
                  key={p.id}
                  canManage={canManage}
                  warehouses={warehouses}
                  purchase={{
                    id: p.id,
                    supplierName: p.suppliers?.name ?? "—",
                    status: p.status,
                    total: p.total,
                    issuedAt: p.issued_at,
                    createdAt: p.created_at,
                    items: p.purchase_items.map((it) => ({
                      id: it.id,
                      productName: it.products?.name ?? "—",
                      productSku: it.products?.sku ?? "—",
                      qty: it.qty,
                      unitCost: it.unit_cost,
                      taxRate: it.tax_rate,
                    })),
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {canManage
            ? "Aún no tienes órdenes de compra. Crea la primera arriba."
            : "Aún no hay órdenes de compra registradas."}
        </p>
      )}
    </div>
  );
}
