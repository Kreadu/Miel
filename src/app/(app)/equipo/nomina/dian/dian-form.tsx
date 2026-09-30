"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { saveDianSettings } from "@/actions/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type DianValues = {
  nit: string;
  dv: string;
  company_name: string;
  software_id: string;
  software_pin: string;
  test_set_id: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
};

// Etiquetas en `rrhh.dian.fields.<name>` (y `<name>_hint` si `hint`).
const FIELDS: { name: keyof DianValues; required?: boolean; wide?: boolean; hint?: boolean }[] = [
  { name: "company_name", required: true, wide: true },
  { name: "nit", required: true },
  { name: "dv", required: true },
  { name: "software_id", required: true, hint: true },
  { name: "software_pin", required: true },
  { name: "test_set_id" },
  { name: "email" },
  { name: "address", wide: true },
  { name: "city" },
  { name: "department" },
  { name: "phone" },
];

/** S21-05: datos de la empresa que van en el XML de nómina electrónica. */
export function DianForm({ values }: { values?: DianValues }) {
  const [state, action, pending] = useActionState(saveDianSettings, null);
  const t = useTranslations();

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.name} className={`flex flex-col gap-2 ${f.wide ? "sm:col-span-2" : ""}`}>
            <Label htmlFor={`dian-${f.name}`}>{t(`rrhh.dian.fields.${f.name}`)}</Label>
            <Input
              id={`dian-${f.name}`}
              name={f.name}
              required={f.required}
              type={f.name === "software_pin" ? "password" : f.name === "email" ? "email" : "text"}
              autoComplete="off"
              defaultValue={values?.[f.name] ?? ""}
            />
            {f.hint ? <span className="text-xs text-muted-foreground">{t(`rrhh.dian.fields.${f.name}_hint`)}</span> : null}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t("rrhh.common.saving") : t("rrhh.dian.save")}
        </Button>
        {state?.ok ? <span className="text-sm text-muted-foreground">{t("rrhh.common.saved")}</span> : null}
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}
