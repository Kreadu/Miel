import Link from "next/link";
import { ClipboardList, Truck, Wallet } from "lucide-react";

export const metadata = { title: "Comprar · Miel" };

export default function ComprasPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Comprar</h1>
          <p className="text-sm text-muted-foreground">
            Lo que compras para tener tu oferta en inventario: son tus costos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/compras/ordenes"
            className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Órdenes de compra
          </Link>
          <Link
            href="/compras/proveedores"
            className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            <Truck className="mr-2 h-4 w-4" />
            Proveedores
          </Link>
          <Link
            href="/compras/cuentas-por-pagar"
            className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            <Wallet className="mr-2 h-4 w-4" />
            CxP
          </Link>
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Registra tus proveedores y crea órdenes de compra desde los accesos de arriba.
        </p>
      </div>
    </div>
  );
}
