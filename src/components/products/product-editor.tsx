"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";

import { createProduct, updateProduct } from "@/actions/products";
import { Button } from "@/components/ui/button";

import { ProductFields } from "./product-fields";
import type { Category, ProductView } from "./types";

/**
 * S19-24: formulario único de producto — alta (sin `product`) o edición. Lo usan Inventario y
 * Catálogo. `onDone` se avisa en un efecto: cierra/navega en el padre, no en el render de acá.
 */
export function ProductEditor({
  product,
  categories,
  onDone,
}: {
  product?: ProductView;
  categories: Category[];
  onDone: () => void;
}) {
  const t = useTranslations("catalog");
  const [state, formAction, pending] = useActionState(product ? updateProduct : createProduct, null);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form
      action={formAction}
      className="flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <ProductFields product={product} categories={categories} />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : product ? t("save") : t("createProduct")}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t("cancel")}
        </Button>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
