import Link from "next/link";
import { notFound } from "next/navigation";
import { Landmark, ShoppingBag, ShoppingCart, Truck, Users, Wallet } from "lucide-react";

import { getActiveTenant } from "@/lib/tenant/server";

export const metadata = { title: "Vender · Miel" };

export default async function VentasPage() {
  const { active } = await getActiveTenant();
  if (!active) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Vender</h1>
          <p className="text-sm text-muted-foreground">Aquí vendes tus productos y servicios.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/ventas/clientes"
            className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            <Users className="mr-2 h-4 w-4" />
            Clientes
          </Link>
          {active.sellsPhysical && (
            <>
              <Link
                href="/ventas/pedidos"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Pedidos
              </Link>
              <Link
                href="/ventas/caja"
                className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
              >
                <Wallet className="mr-2 h-4 w-4" />
                Caja
              </Link>
            </>
          )}
          {/* S19-35: transportes y tarifas para "Envío por transporte" en el pedido. */}
          <Link
            href="/ventas/envios"
            className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            <Truck className="mr-2 h-4 w-4" />
            Envíos
          </Link>
          {/* S19-36: la venta se arma desde el Catálogo, así que se muestra siempre. */}
          <Link
            href="/ventas/catalogo"
            className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            Catálogo
          </Link>
          {active.role !== "member" && (
            <Link
              href="/ventas/cuentas-por-cobrar"
              className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
            >
              <Landmark className="mr-2 h-4 w-4" />
              Cuentas por cobrar
            </Link>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Gestiona tus clientes y tu sucursal desde los accesos de arriba.
        </p>
      </div>
    </div>
  );
}
