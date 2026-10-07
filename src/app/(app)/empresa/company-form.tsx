"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { saveCompany } from "@/actions/company";
import { EditActions, useEditMode } from "@/components/edit-mode";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Company = {
  name: string;
  nit: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
};

const FIELDS = [
  { name: "name", max: 120, required: true },
  { name: "nit", max: 30 },
  { name: "address", max: 200, wide: true },
  { name: "city", max: 80 },
  { name: "phone", max: 30, type: "tel" },
  { name: "email", max: 160, type: "email" },
] as const;

/** S26-01: formulario de "Mi empresa" con logo (vista previa y "quitar logo"). */
export function CompanyForm({ values }: { values: Company }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(saveCompany, null);
  const mode = useEditMode(state);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <fieldset key={mode.formKey} disabled={!mode.editing} className="contents">
      <div className="flex flex-col gap-2">
        <Label htmlFor="logo">{t("company.logo")}</Label>
        {values.logo_url ? (
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-32 overflow-hidden rounded-md border border-border bg-white">
              <Image src={values.logo_url} alt={t("company.logo")} fill unoptimized className="object-contain" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="remove_logo" className="h-4 w-4 accent-primary" />
              {t("company.removeLogo")}
            </label>
          </div>
        ) : null}
        <Input id="logo" name="logo" type="file" accept="image/jpeg,image/png,image/webp" />
        <p className="text-xs text-muted-foreground">{t("company.logoHelp")}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.name} className={`flex flex-col gap-2 ${"wide" in f ? "sm:col-span-2" : ""}`}>
            <Label htmlFor={`company-${f.name}`}>{t(`company.fields.${f.name}`)}</Label>
            <Input
              id={`company-${f.name}`}
              name={f.name}
              type={"type" in f ? f.type : "text"}
              required={"required" in f}
              maxLength={f.max}
              defaultValue={values[f.name] ?? ""}
            />
          </div>
        ))}
      </div>
      </fieldset>
      <EditActions editing={mode.editing} pending={pending} saved={!!state?.ok} onEdit={mode.edit} onCancel={mode.cancel} />
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}
