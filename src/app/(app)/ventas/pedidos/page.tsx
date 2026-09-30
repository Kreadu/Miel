import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { isPendingSale } from "@/lib/sales/pending";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { CatalogPedidoCart } from "./catalog-pedido-cart";
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
  const [salesRes, customersRes, warehousesRes, mySessionRes, ratesRes] = await Promise.all([
    supabase
      .from("sales")
      .select("id, status, total, receipt_number, issued_at, created_at, shipping_address, customer_id, payment_method, customers(name), customer_payments(amount)")
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id, name").eq("active", true).order("name"),
    supabase.from("warehouses").select("id, name").eq("active", true).order("name"),
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
  ]);
  const cashOpen = mySessionRes.data != null;

  // S19-36: Pedidos = hoja de venta + pedidos por completar. Lo terminado (entregado y pagado,
  // o cancelado) queda en el historial de compras de cada cliente.
  const sales = (salesRes.data ?? [])
    .map((s) => ({ ...s, balance: s.total - s.customer_payments.reduce((sum, p) => sum + p.amount, 0) }))
    .filter((s) => isPendingSale(s.status, s.balance));
  const customers = customersRes.data ?? [];
  const warehouses = warehousesRes.data ?? [];

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
      />

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
                  }}
                  warehouses={warehouses}
                  canCancel={active.role !== "member"}
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
