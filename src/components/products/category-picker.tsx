"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { CategoryManager } from "./category-manager";

// El <Select> de Radix no admite value="" — mismo sentinel que lee `src/actions/catalog.ts`.
const NO_CATEGORY = "__none__";

type Category = { id: string; name: string };

/**
 * S19-16/S19-21: selector de categoría + "+" que abre la misma ventana de categorías del botón
 * "Categorías" (crear/renombrar/eliminar). Una categoría creada desde acá queda elegida sin
 * tocar el resto del formulario del producto.
 */
export function CategoryPicker({
  categories,
  defaultCategoryId,
}: {
  categories: Category[];
  defaultCategoryId?: string | null;
}) {
  const t = useTranslations("catalog");
  const [value, setValue] = useState(defaultCategoryId || NO_CATEGORY);
  // Si la categoría elegida se eliminó en la ventana, vuelve a "Sin categoría".
  const selected = categories.some((c) => c.id === value) ? value : NO_CATEGORY;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="category_id">{t("category")}</Label>
      <div className="flex items-center gap-2">
        <Select name="category_id" value={selected} onValueChange={setValue}>
          <SelectTrigger id="category_id" className="w-full">
            <SelectValue placeholder={t("noCategory")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CATEGORY}>{t("noCategory")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <CategoryManager
          categories={categories}
          onCreated={(c) => setValue(c.id)}
          trigger={
            <Button type="button" variant="outline" size="icon" aria-label={t("categories")}>
              <Plus className="size-4" />
            </Button>
          }
        />
      </div>
    </div>
  );
}
