import { Truck, Wallet } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { parseProductIds, suggestedReorderQty } from "@/lib/purchases/reorder";
import { groupByProduct } from "@/lib/purchases/warehouse-split";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { PurchaseForm } from "./ordenes/purchase-form";
import { PurchaseHistory, type PurchaseHistoryParams } from "./ordenes/purchase-history";
import { PurchaseRow } from "./ordenes/purchase-row";

export async function generateMetadata() {
  const t = await getTranslations("purchases");
  return { title: `${t("title")} · Miel` };
}

const LINK_CLASS =
  "inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80";

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string; reponer?: string } & PurchaseHistoryParams>;
}) {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const canManage = active.role !== "member";
  const t = await getTranslations("purchases");
  const { editar, reponer, ...history } = await searchParams;
  // S19-27/S19-37: ítems elegidos en Alertas stock mínimo (`?reponer=<id>,<id>`).
  const fromAlerts = parseProductIds(reponer);

  const supabase = await createClient();
  const [purchasesRes, suppliersRes, productsRes, warehousesRes, supplierProductsRes, alertsRes, approverRes] =
    await Promise.all([
      supabase
        .from("purchases")
        .select(
          "id, number, status, total, issued_at, created_at, note, supplier_id, requested_by_name, requested_at, approved_by_name, approved_at, suppliers(name, phone), purchase_items(id, qty, received_qty, unit_cost, tax_rate, product_id, warehouse_id, products(sku, name), warehouses(name))",
        )
        // S19-37: a la vista solo las órdenes por recibir; el resto está en el Historial.
        .in("status", ["draft", "ordered", "partially_received"])
        .order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
      supabase
        .from("products_catalog")
        .select("id, sku, name, cost, tax_rate, photo_url")
        .eq("active", true)
        .order("name"),
      supabase.from("warehouses").select("id, name, is_default").eq("active", true).order("is_default", { ascending: false }).order("name"),
      supabase.from("supplier_products").select("supplier_id, product_id"),
      fromAlerts.length
        ? supabase
            .from("low_stock_alerts")
            .select("product_id, min_stock, total_qty")
            .in("product_id", fromAlerts)
        : Promise.resolve({ data: [] }),
      // S26-02: dueño o admin marcado como aprobador.
      supabase.rpc("user_can_approve_purchases", { p_tenant_id: active.tenantId }),
    ]);
  const canApprove = approverRes.data === true;

  const purchases = purchasesRes.data ?? [];
  const suppliers = suppliersRes.data ?? [];
  const warehouses = warehousesRes.data ?? [];
  const defaultWarehouse = warehouses[0]?.id;
  const products = (productsRes.data ?? []).filter((p) => p.id) as {
    id: string;
    sku: string;
    name: string;
    cost: number | null;
    tax_rate: number | null;
    photo_url: string | null;
  }[];

  // Sugeridos por proveedor para el selector de producto (S15-01): agrupa en servidor,
  // sin refetch al cambiar de proveedor en el cliente.
  const suggestedBySupplier: Record<string, string[]> = {};
  for (const sp of supplierProductsRes.data ?? []) {
    (suggestedBySupplier[sp.supplier_id] ??= []).push(sp.product_id);
  }

  // S26-10: solo un borrador, y solo el dueño o un aprobador.
  const editingPurchase = canApprove ? purchases.find((p) => p.id === editar && p.status === "draft") : undefined;

  const alertById = new Map((alertsRes.data ?? []).map((a) => [a.product_id, a]));
  const initialItems = fromAlerts
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is (typeof products)[number] => p != null)
    .map((p) => {
      const alert = alertById.get(p.id);
      const qty = String(suggestedReorderQty(Number(alert?.min_stock ?? 0), Number(alert?.total_qty ?? 0)));
      return {
        product_id: p.id,
        qty,
        // S26-11: con varias bodegas, lo sugerido va a la principal (se reparte a mano).
        byWarehouse: (defaultWarehouse ? { [defaultWarehouse]: qty } : {}) as Record<string, string>,
        // S23-01: el costo del producto no lleva IVA (se recupera).
        unit_cost: String(p.cost ?? 0),
        tax_rate: String(p.tax_rate ?? 0),
      };
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/compras/proveedores" className={LINK_CLASS}>
            <Truck className="mr-2 h-4 w-4" />
            {t("suppliers")}
          </Link>
          <Link href="/compras/cuentas-por-pagar" className={LINK_CLASS}>
            <Wallet className="mr-2 h-4 w-4" />
            {t("payables")}
          </Link>
        </div>
      </div>

      {canManage ? (
        editingPurchase ? (
          // key: sin ella React reusa el formulario de "nueva orden" y no carga la que se edita.
          <PurchaseForm
            key={editingPurchase.id}
            suppliers={suppliers}
            products={products}
            warehouses={warehouses}
            suggestedBySupplier={suggestedBySupplier}
            purchase={{
              id: editingPurchase.id,
              number: editingPurchase.number,
              supplier_id: editingPurchase.supplier_id,
              note: editingPurchase.note ?? "",
              items: groupByProduct(editingPurchase.purchase_items, warehouses),
            }}
          />
        ) : (
          <PurchaseForm
            key="new"
            suppliers={suppliers}
            products={products}
            warehouses={warehouses}
            suggestedBySupplier={suggestedBySupplier}
            initialItems={initialItems}
            canApprove={canApprove}
          />
        )
      ) : null}

      <h2 className="text-base font-semibold tracking-tight">{t("toReceive")}</h2>
      {purchases.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("supplier")}</th>
                <th className="px-3 py-2 font-medium">{t("status")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("total")}</th>
                <th className="px-3 py-2 font-medium">{t("date")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <PurchaseRow
                  key={p.id}
                  canManage={canManage}
                  canApprove={canApprove}
                  purchase={{
                    id: p.id,
                    number: p.number,
                    supplierName: p.suppliers?.name ?? "—",
                    supplierPhone: p.suppliers?.phone ?? null,
                    status: p.status,
                    total: p.total,
                    issuedAt: p.issued_at,
                    createdAt: p.created_at,
                    requestedByName: p.requested_by_name,
                    requestedAt: p.requested_at,
                    approvedByName: p.approved_by_name,
                    approvedAt: p.approved_at,
                    items: p.purchase_items.map((it) => ({
                      id: it.id,
                      productName: it.products?.name ?? "—",
                      productSku: it.products?.sku ?? "—",
                      qty: it.qty,
                      warehouseName: it.warehouses?.name ?? null,
                      receivedQty: it.received_qty,
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
          {canManage ? t("emptyManage") : t("emptyPublic")}
        </p>
      )}

      <PurchaseHistory suppliers={suppliers} params={history} />
    </div>
  );
}
