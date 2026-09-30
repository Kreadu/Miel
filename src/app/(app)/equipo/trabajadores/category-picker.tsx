"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { quickCreateWorkerCategory } from "@/actions/workers";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_MODULES } from "@/lib/rrhh/workers";

// Mismo sentinel que lee src/actions/workers.ts (Radix no admite value="").
const NONE = "__none__";

type Category = { id: string; name: string };

/**
 * S21-02b: categoría del trabajador + "+" para crear una sin salir de la ficha (modal sin
 * <form>: vive dentro del form del trabajador). La creada queda elegida.
 */
export function WorkerCategoryPicker({
  id,
  categories,
  defaultValue,
}: {
  id: string;
  categories: Category[];
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue || NONE);
  const [created, setCreated] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [modules, setModules] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useTranslations();

  const options = [...categories, ...created.filter((c) => !categories.some((x) => x.id === c.id))];

  function handleCreate() {
    startTransition(async () => {
      const result = await quickCreateWorkerCategory({ name, modules });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreated((prev) => [...prev, result.category]);
      setValue(result.category.id);
      setName("");
      setModules([]);
      setError(null);
      setOpen(false);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t("rrhh.workers.categoryPicker.label")}</Label>
      <div className="flex items-center gap-2">
        <Select name="category_id" value={value} onValueChange={setValue}>
          <SelectTrigger id={id} className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("rrhh.workers.categoryPicker.none")}</SelectItem>
            {options.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label={t("rrhh.workers.categoryPicker.create")}>
              <Plus className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("rrhh.workers.categoryPicker.new")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-new-name`}>{t("rrhh.common.name")}</Label>
                <Input
                  id={`${id}-new-name`}
                  placeholder={t("rrhh.common.categoryPlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  autoFocus
                />
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">{t("rrhh.common.whatCanSee")}</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {CATEGORY_MODULES.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={modules.includes(m.id)}
                        onChange={(e) =>
                          setModules((prev) =>
                            e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id),
                          )
                        }
                        className="h-4 w-4 accent-primary"
                      />
                      {t(`rrhh.modules.${m.id}`)}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("rrhh.common.adminOnlyModules")}
                </p>
              </fieldset>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {t(error)}
                </p>
              ) : null}
              <Button type="button" onClick={handleCreate} disabled={pending || !name.trim()}>
                {pending ? t("rrhh.common.creating") : t("rrhh.workers.categoryPicker.create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
