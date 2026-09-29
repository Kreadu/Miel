"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { InventoryId } from "@/lib/inventories";

import { ProductEditor } from "./product-editor";
import type { Category, ProductFormMode, Warehouse } from "./types";

/** S19-24/S19-26: botón de alta de cada inventario (y del Catálogo): abre el formulario único. */
export function NewProductButton({
  mode,
  inventory,
  label,
  categories,
  warehouses,
}: {
  mode: ProductFormMode;
  inventory: InventoryId;
  label: string;
  categories: Category[];
  warehouses: Warehouse[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) return <Button onClick={() => setOpen(true)}>{label}</Button>;
  // El form se desmonta al cerrar: la próxima vez abre limpio, sin reset manual.
  return (
    <ProductEditor
      mode={mode}
      inventory={inventory}
      categories={categories}
      warehouses={warehouses}
      onDone={() => setOpen(false)}
    />
  );
}
