"use client";

import Image from "next/image";
import Link from "next/link";
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
};

/**
 * S19-27/S19-29: ítems de un inventario bajo su stock mínimo, con foto. "Agregar a orden de
 * compra" los junta; "Crear orden de compra" abre la orden con esos ítems cargados — el
 * proveedor se elige allá.
 */
export function AlertsList({ items, canManage }: { items: AlertItem[]; canManage: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);

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
            Agregar todos
          </Button>
          {selected.length > 0 ? (
            <Button asChild size="sm">
              <Link href={`/compras/ordenes?desde=${selected.join(",")}`}>
                Crear orden de compra ({selected.length})
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
                    Sin foto
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 p-3">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.sku}</p>
                <p className="text-sm">
                  <span className="font-semibold tabular-nums text-destructive">
                    {item.totalQty.toLocaleString("es-CO")}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    de mínimo {item.minStock.toLocaleString("es-CO")} {item.unit}
                  </span>
                </p>
                {canManage ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? "secondary" : "default"}
                    className="mt-2"
                    onClick={() => toggle(item.productId)}
                  >
                    {isSelected ? "Agregado ✓ (quitar)" : "Agregar a orden de compra"}
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
