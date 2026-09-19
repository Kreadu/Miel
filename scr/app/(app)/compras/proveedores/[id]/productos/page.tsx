import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { getActiveTenant } from "@/lib/tenant/server";

import { LinkSupplierProductForm } from "./link-supplier-product-form";
import { UnlinkSupplierProductAction } from "./unlink-supplier-product-action";

export const metadata = { title: "Productos del proveedor · Miel" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SupplierProductsPage({ params }: PageProps) {
  const { id } = await params;
  const { active } = await getActiveTenant();
  if (!active) notFound();

  const canManage = active.role !== "member";

  const supabase = await createClient();
  const [supplierRes, linksRes, productsRes] = await Promise.all([
    supabase.from("suppliers").select("name").eq("id", id).single(),
    supabase
      .from("supplier_products")
      .select("product_id, last_purchased_at, products(sku, name, active)")
      .eq("supplier_id", id)
      .order("last_purchased_at", { ascending: false, nullsFirst: false }),
    supabase.from("products_catalog").select("id, sku, name").eq("active", true).order("name"),
  ]);

  if (supplierRes.error || !supplierRes.data) notFound();

  const supplier = supplierRes.data;
  const links = linksRes.data ?? [];
  const products = (productsRes.data ?? []).filter((p) => p.id) as {
    id: string;
    sku: string;
    name: string;
  }[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Link
            href="/compras/proveedores"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Productos del proveedor</h1>
        </div>
        <p className="text-sm text-muted-foreground">{supplier.name}</p>
      </div>

      {canManage ? <LinkSupplierProductForm supplierId={id} products={products} /> : null}

      {links.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 font-medium">Última recepción</th>
                {canManage ? <th className="px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.product_id} className="border-b border-border text-sm last:border-0">
                  <td
                    className={`px-3 py-2.5 ${l.products?.active ? "" : "text-muted-foreground line-through"}`}
                  >
                    {l.products ? `${l.products.sku} — ${l.products.name}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {l.last_purchased_at ? formatDateTime(l.last_purchased_at) : "Aún sin recibir"}
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2.5 text-right">
                      <UnlinkSupplierProductAction supplierId={id} productId={l.product_id} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aún no hay productos asociados. Se asocian solos al recibir una compra de este
          proveedor, o los puedes agregar {canManage ? "arriba" : "cuando gestiones el equipo"}.
        </p>
      )}
    </div>
  );
}
