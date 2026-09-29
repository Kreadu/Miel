"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";

import { createCategory, deleteCategory, renameCategory } from "@/actions/catalog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Category = { id: string; name: string };

/**
 * S19-21: ventana única de categorías (crear, renombrar, eliminar). La abren el botón
 * "Categorías" del catálogo y el "+" del formulario de producto (con `onCreated`, que deja
 * elegida la categoría nueva). Sin <form>: vive dentro del form del producto y no puede anidarse.
 * La lista se refresca sola: cada action hace `revalidatePath` y llegan `categories` nuevas.
 */
export function CategoryManager({
  categories,
  trigger,
  onCreated,
}: {
  categories: Category[];
  trigger: ReactNode;
  onCreated?: (category: Category) => void;
}) {
  const t = useTranslations("catalog");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createCategory(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      setError(null);
      if (onCreated) {
        onCreated(result.category);
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("categories")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new_category_name">{t("newCategory")}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="new_category_name"
                placeholder={t("categoryNamePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                maxLength={60}
                autoFocus
              />
              <Button type="button" onClick={handleCreate} disabled={pending || !name.trim()}>
                {t("createCategory")}
              </Button>
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          {categories.length > 0 ? (
            <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {categories.map((c) => (
                <CategoryItem key={c.id} category={c} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noCategoriesYet")}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryItem({ category }: { category: Category }) {
  const t = useTranslations("catalog");
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setMode("view");
    });
  }

  return (
    <li className="flex flex-col gap-1 px-3 py-2 text-sm">
      {mode === "edit" ? (
        <div className="flex items-center gap-2">
          <Label htmlFor={`category-${category.id}`} className="sr-only">
            {t("name")}
          </Label>
          <Input
            id={`category-${category.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                run(() => renameCategory(category.id, name));
              }
            }}
            maxLength={60}
            className="h-8"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            disabled={pending || !name.trim()}
            onClick={() => run(() => renameCategory(category.id, name))}
          >
            {t("save")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode("view")}>
            {t("cancel")}
          </Button>
        </div>
      ) : mode === "confirmDelete" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{t("deleteCategoryConfirm", { name: category.name })}</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => run(() => deleteCategory(category.id))}
            >
              {t("delete")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode("view")}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span>{category.name}</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`${t("edit")} ${category.name}`}
              onClick={() => {
                setName(category.name);
                setMode("edit");
              }}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`${t("delete")} ${category.name}`}
              onClick={() => setMode("confirmDelete")}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}
