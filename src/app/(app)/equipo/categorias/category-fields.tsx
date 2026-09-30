"use client";

import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_MODULES } from "@/lib/rrhh/workers";

/** S21-02: nombre de la categoría + módulos que ve (casillas). */
export function CategoryFields({
  idPrefix,
  name,
  modules = [],
}: {
  idPrefix: string;
  name?: string;
  modules?: string[];
}) {
  const t = useTranslations("rrhh");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:max-w-sm">
        <Label htmlFor={`${idPrefix}-name`}>{t("categories.name")}</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          required
          maxLength={60}
          placeholder={t("common.categoryPlaceholder")}
          defaultValue={name}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("common.whatCanSee")}</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {CATEGORY_MODULES.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="modules"
                value={m.id}
                defaultChecked={modules.includes(m.id)}
                className="h-4 w-4 accent-primary"
              />
              {t(`modules.${m.id}`)}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("common.adminOnlyModules")}
        </p>
      </fieldset>
    </div>
  );
}
