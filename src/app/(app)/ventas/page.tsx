import Link from "next/link";
import { notFound } from "next/navigation";
import { Landmark, ShoppingCart, Truck, Users, Wallet } from "lucide-react";

import { getTranslations } from "next-intl/server";

import { getActiveTenant } from "@/lib/tenant/server";

import { CatalogSection } from "./catalogo/catalog-section";

export async function generateMetadata() {
  const t = await getTranslations("sales");
  return { title: `${t("title")} · Miel` };
}

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { active } = await getActiveTenant();
  if (!active) notFound();
  const { categoria } = await searchParams;
  const t = await getTranslations("sales");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/ventas/clientes"
            className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            <Users className="mr-2 h-4 w-4" />
            {t("links.customers")}
          </Link>
          {active.sellsPhysical && (
            <>
              <Link
                href="/ventas/pedidos"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {t("links.orders")}
              </Link>
              <Link
                href="/ventas/caja"
                className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
              >
                <Wallet className="mr-2 h-4 w-4" />
                {t("links.cash")}
              </Link>
            </>
          )}
          {/* S19-35: transportes y tarifas para "Envío por transporte" en el pedido. */}
          <Link
            href="/ventas/envios"
            className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            <Truck className="mr-2 h-4 w-4" />
            {t("links.shipping")}
          </Link>
          {active.role !== "member" && (
            <Link
              href="/ventas/cuentas-por-cobrar"
              className="inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80"
            >
              <Landmark className="mr-2 h-4 w-4" />
              {t("links.receivables")}
            </Link>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      {/* S19-41: el Catálogo vive aquí (antes era una página aparte con su propio botón). */}
      <CatalogSection active={active} categoria={categoria} />
    </div>
  );
}
