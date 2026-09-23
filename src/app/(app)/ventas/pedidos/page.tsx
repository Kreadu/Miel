import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { SaleForm } from "./sale-form";
import { SaleRow } from "./sale-row";

export const metadata = { title: "Pedidos · Miel" };

export default async function PedidosPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const supabase = await createClient();
  const [salesRes, customersRes, productsRes, warehousesRes] = await Promise.all([
    supabase
      .from("sales")
      .select("id, status, total, receipt_number, issued_at, created_at, shipping_address, customer_id, customers(name), customer_payments(amount)")
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id, name").eq("active", true).order("name"),
    supabase
      .from("products_catalog")
      .select("id, sku, name, price, tax_rate")
      .eq("active", true)
      .order("name"),
    supabase.from("warehouses").select("id, name").eq("active", true).order("name"),
  ]);

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
