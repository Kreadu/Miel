"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { InventoryId } from "@/lib/inventories";

import { ProductEditor } from "./product-editor";
import type { Category } from "./types";

/** S19-24/S19-26: botón de alta de cada inventario (y del Catálogo): abre el formulario único. */
export function NewProductButton({
  inventory,
  label,
  categories,
}: {
  inventory: InventoryId;
  label: string;
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) return <Button onClick={() => setOpen(true)}>{label}</Button>;
  // El form se desmonta al cerrar: la próxima vez abre limpio, sin reset manual.
  return (
    <ProductEditor inventory={inventory} categories={categories} onDone={() => setOpen(false)} />
  );
}
