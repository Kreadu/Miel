"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { ProductEditor } from "./product-editor";
import type { Category } from "./types";

/** S19-24: "Generar producto" (Catálogo) y "+ Nuevo producto" (Inventario) abren el mismo formulario. */
export function NewProductButton({ label, categories }: { label: string; categories: Category[] }) {
  const [open, setOpen] = useState(false);

  if (!open) return <Button onClick={() => setOpen(true)}>{label}</Button>;
  // El form se desmonta al cerrar: la próxima vez abre limpio, sin reset manual.
  return <ProductEditor categories={categories} onDone={() => setOpen(false)} />;
}
