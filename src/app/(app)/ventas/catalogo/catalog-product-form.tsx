"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { createCatalogProduct } from "@/actions/catalog";
import { Button } from "@/components/ui/button";

import { CatalogProductFields } from "./catalog-product-fields";

export function CatalogProductForm({
  warehouses = [],
  categories = [],
}: {
  warehouses?: { id: string; name: string }[];
  categories?: { id: string; name: string }[];
}) {
  const t = useTranslations("catalog");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createCatalogProduct, null);

  // Ajuste de estado durante el render (patrón de WarehouseRow, no un efecto): al ver un
  // `state` de éxito nuevo, cierra el formulario. El <form> se desmonta al cerrar, así que sus
  // inputs (sin controlar) quedan limpios solos la próxima vez que se abra — sin reset manual.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setOpen(false);
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>{t("generateProduct")}</Button>;
  }

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs sm:w-96"
    >
      <CatalogProductFields warehouses={warehouses} categories={categories} />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {t("generateProduct")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
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
