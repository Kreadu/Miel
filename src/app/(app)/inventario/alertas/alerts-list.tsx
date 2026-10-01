"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export type AlertItem = {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  photoUrl: string | null;
  minStock: number;
  totalQty: number;
  /** S19-40: agotado (llegó a 0), aunque su mínimo sea 0. */
  outOfStock: boolean;
};

/**
 * S19-27/S19-29: ítems de un inventario bajo su stock mínimo, con foto. "Agregar a orden de
 * compra" los junta; "Crear orden de compra" abre la orden con esos ítems cargados — el
 * proveedor se elige allá.
 */
export function AlertsList({ items, canManage }: { items: AlertItem[]; canManage: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const t = useTranslations("inventory.alertsPage");

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelected(items.map((i) => i.productId))}
          >
            {t("addAll")}
          </Button>
          {selected.length > 0 ? (
            <Button asChild size="sm">
              <Link href={`/compras?reponer=${selected.join(",")}`}>
                {t("createPurchase", { count: selected.length })}
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const isSelected = selected.includes(item.productId);
          return (
            <div
              key={item.productId}
              className={`flex flex-col overflow-hidden rounded-lg border bg-card shadow-xs ${
                isSelected ? "border-primary" : "border-border"
              }`}
            >
              <div className="relative aspect-square w-full bg-muted">
                {item.photoUrl ? (
                  <Image src={item.photoUrl} alt={item.name} fill unoptimized className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    {t("noPhoto")}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 p-3">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.sku}</p>
                {item.outOfStock ? (
                  <p className="w-fit rounded-sm bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">
                    {t("outOfStock")}
                  </p>
                ) : (
                  <p className="text-sm">
                    <span className="font-semibold tabular-nums text-destructive">
                      {item.totalQty.toLocaleString("es-CO")}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {t("ofMinimum", { min: item.minStock.toLocaleString("es-CO"), unit: item.unit })}
                    </span>
                  </p>
                )}
                {canManage ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? "secondary" : "default"}
                    className="mt-2"
                    onClick={() => toggle(item.productId)}
                  >
                    {isSelected ? t("added") : t("addToPurchase")}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
