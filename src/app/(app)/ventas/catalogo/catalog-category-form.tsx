"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { createCategory } from "@/actions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CatalogCategoryForm() {
  const t = useTranslations("catalog");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createCategory, null);

  // Ajuste de estado durante el render (mismo patrón que CatalogProductForm).
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setOpen(false);
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("generateCategory")}
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-xs sm:flex-row sm:items-end"
    >
      <Input
        name="name"
        placeholder={t("categoryNamePlaceholder")}
        maxLength={60}
        required
        className="h-9"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {t("createCategory")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
