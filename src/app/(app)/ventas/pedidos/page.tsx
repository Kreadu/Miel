import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { CatalogPedidoCart } from "./catalog-pedido-cart";
import { SaleForm } from "./sale-form";
import { SaleRow } from "./sale-row";

export const metadata = { title: "Pedidos · Miel" };

export default async function PedidosPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [salesRes, customersRes, productsRes, warehousesRes, mySessionRes] = await Promise.all([
    supabase
      .from("sales")
      .select("id, status, total, receipt_number, issued_at, created_at, shipping_address, customer_id, payment_method, customers(name), customer_payments(amount)")
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id, name").eq("active", true).order("name"),
    // S19-05: Pedidos es canal físico — solo productos marcados "in_store" o "both".
    // S19-26: y solo del Inventario de productos (lo que se vende).
    supabase
      .from("products_catalog")
      .select("id, sku, name, price, tax_rate")
      .eq("active", true)
      .eq("inventory", "productos")
      .in("sales_channel", ["in_store", "both"])
      .order("name"),
    supabase.from("warehouses").select("id, name").eq("active", true).order("name"),
    // S19-22: la boleta de productos de tienda exige la caja abierta de quien confirma.
    supabase
      .from("cash_sessions")
      .select("id")
      .eq("tenant_id", active.tenantId)
      .eq("opened_by", user?.id ?? "")
      .eq("status", "open")
      .maybeSingle(),
  ]);
  const cashOpen = mySessionRes.data != null;

  const sales = salesRes.data ?? [];
  const customers = customersRes.data ?? [];
  const products = (productsRes.data ?? []).filter((p) => p.id) as {
    id: string;
    sku: string;
    name: string;
    price: number | null;
    tax_rate: number | null;
  }[];
  const warehouses = warehousesRes.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-sm text-muted-foreground">{active.tenantName}</p>
      </div>

      {cashOpen ? null : (
        <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          Tu caja está cerrada: puedes crear pedidos, pero para generar la boleta de productos que
          se venden en tienda{" "}
          <Link href="/ventas/caja" className="font-medium text-foreground underline underline-offset-4">
            abre la caja
          </Link>
          .
        </p>
      )}

      <CatalogPedidoCart tenantId={active.tenantId} customers={customers} />

      <SaleForm customers={customers} products={products} />

      {sales.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium text-right">Acciones</th>
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
                    balance: s.total - s.customer_payments.reduce((sum, p) => sum + p.amount, 0),
                    issuedAt: s.issued_at,
                    createdAt: s.created_at,
                    shippingAddress: s.shipping_address,
                    paymentMethod: s.payment_method,
                  }}
                  warehouses={warehouses}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aún no tienes pedidos. Crea el primero arriba.
        </p>
      )}
    </div>
  );
}
