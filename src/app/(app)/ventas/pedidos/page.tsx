import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { isPendingSale } from "@/lib/sales/pending";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { CatalogPedidoCart } from "./catalog-pedido-cart";
import { MarkInvoiceIssuedButton } from "./mark-invoice-issued-button";
import type { StockMap } from "./allocation-picker";
import { SaleRow } from "./sale-row";

export async function generateMetadata() {
  const t = await getTranslations("sales.orders");
  return { title: `${t("title")} · Miel` };
}

export default async function PedidosPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();
  const t = await getTranslations("sales.orders");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canManage = active.role !== "member";
  const [salesRes, customersRes, warehousesRes, mySessionRes, ratesRes, defaultWarehouseRes, invoicesRes] = await Promise.all([
    supabase
      .from("sales")
      .select("id, status, total, receipt_number, issued_at, created_at, shipping_address, customer_id, payment_method, customers(name), customer_payments(amount), sale_items(product_id, qty, products(name))")
      .eq("tenant_id", active.tenantId)
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id, name").eq("tenant_id", active.tenantId).eq("active", true).order("name"),
    supabase
      .from("warehouses")
      .select("id, name, lends_stock")
      .eq("tenant_id", active.tenantId)
      .eq("active", true)
      .order("name"),
    // S19-22: la boleta de productos de tienda exige la caja abierta de quien confirma.
    supabase
      .from("cash_sessions")
      .select("id")
      .eq("tenant_id", active.tenantId)
      .eq("opened_by", user?.id ?? "")
      .eq("status", "open")
      .maybeSingle(),
    // S19-35: transportes para "Envío por transporte".
    supabase
      .from("shipping_rates")
      .select("id, name, base_price, price_per_kg, price_per_km")
      .order("name"),
    // S18-06: bodega preseleccionada (la del trabajador identificado, si no la principal).
    supabase.rpc("default_sale_warehouse", {
      p_tenant_id: active.tenantId,
      p_worker_id: active.worker?.id,
    }),
    // S18-06: facturas cobradas que el dueño aún debe emitir en su sistema de facturación.
    canManage
      ? supabase
          .from("sales")
          .select("id, total, receipt_number, issued_at, customers(name, doc_type, doc_number)")
          .eq("document_type", "factura")
          .is("invoice_issued_at", null)
          .neq("status", "cancelled")
          .order("issued_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);
  const invoices = invoicesRes.data ?? [];
  const cashOpen = mySessionRes.data != null;

  // S19-36: Pedidos = hoja de venta + pedidos por completar. Lo terminado (entregado y pagado,
  // o cancelado) queda en el historial de compras de cada cliente.
  const sales = (salesRes.data ?? [])
    .map((s) => ({ ...s, balance: s.total - s.customer_payments.reduce((sum, p) => sum + p.amount, 0) }))
    .filter((s) => isPendingSale(s.status, s.balance));
  const customers = customersRes.data ?? [];
  const warehouses = (warehousesRes.data ?? []).map((w) => ({ id: w.id, name: w.name, lendsStock: w.lends_stock }));

  // S18-10: stock por producto y bodega (ver cuánto hay y completar desde otra bodega).
  const { data: stockRows } = await supabase
    .from("current_stock")
    .select("product_id, warehouse_id, total_qty")
    .eq("tenant_id", active.tenantId);
  const stock: StockMap = {};
  for (const r of stockRows ?? []) {
    if (!r.product_id || !r.warehouse_id) continue;
    (stock[r.product_id] ??= {})[r.warehouse_id] = Number(r.total_qty ?? 0);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{active.tenantName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/ventas/catalogo">{t("goToCatalog")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/ventas/clientes">{t("createCustomer")}</Link>
          </Button>
        </div>
      </div>

      {cashOpen ? null : (
        <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          {t.rich("cashClosed", {
            link: (chunks) => (
              <Link href="/ventas/caja" className="font-medium text-foreground underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </p>
      )}

      <CatalogPedidoCart
        tenantId={active.tenantId}
        customers={customers}
        rates={ratesRes.data ?? []}
        warehouses={warehouses}
        defaultWarehouseId={defaultWarehouseRes.data ?? null}
        stock={stock}
      />

      {invoices.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold tracking-tight">{t("invoicesPending")}</h2>
          <p className="text-sm text-muted-foreground">{t("invoicesHelp")}</p>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {inv.customers?.name ?? "—"}
                    {inv.customers?.doc_number ? (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {inv.customers.doc_type?.toUpperCase()} {inv.customers.doc_number}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {inv.receipt_number !== null ? `${t("receipt", { number: inv.receipt_number })} · ` : ""}
                    {inv.issued_at ? formatDate(inv.issued_at) : ""} · {formatMoney(inv.total)}
                  </span>
                </div>
                <MarkInvoiceIssuedButton saleId={inv.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <h2 className="text-base font-semibold tracking-tight">{t("pending")}</h2>
      {sales.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("customer")}</th>
                <th className="px-3 py-2 font-medium">{t("status")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("total")}</th>
                <th className="px-3 py-2 font-medium">{t("date")}</th>
                <th className="px-3 py-2 font-medium text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <SaleRow
                  key={s.id}
                  sale={{
                    id: s.id,
                    customerId: s.customer_id,
                    customerName: s.customers?.name ?? null,
                    status: s.status,
                    receiptNumber: s.receipt_number,
                    total: s.total,
                    balance: s.balance,
                    issuedAt: s.issued_at,
                    createdAt: s.created_at,
                    shippingAddress: s.shipping_address,
                    paymentMethod: s.payment_method,
                    items: s.sale_items.map((it) => ({
                      productId: it.product_id,
                      name: it.products?.name ?? "—",
                      qty: Number(it.qty),
                    })),
                  }}
                  warehouses={warehouses}
                  stock={stock}
                  defaultWarehouseId={defaultWarehouseRes.data ?? null}
                  canCancel={canManage}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      )}
    </div>
  );
}
