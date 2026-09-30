"use client";

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

const FIELDS: { name: keyof DianValues; label: string; required?: boolean; wide?: boolean; hint?: string }[] = [
  { name: "company_name", label: "Razón social", required: true, wide: true },
  { name: "nit", label: "NIT (sin dígito de verificación)", required: true },
  { name: "dv", label: "Dígito de verificación", required: true },
  { name: "software_id", label: "Identificador del software", required: true, hint: "Lo da la DIAN al habilitarte" },
  { name: "software_pin", label: "PIN del software", required: true },
  { name: "test_set_id", label: "TestSetId (solo en habilitación)" },
  { name: "email", label: "Correo" },
  { name: "address", label: "Dirección", wide: true },
  { name: "city", label: "Ciudad" },
  { name: "department", label: "Departamento" },
  { name: "phone", label: "Teléfono" },
];

/** S21-05: datos de la empresa que van en el XML de nómina electrónica. */
export function DianForm({ values }: { values?: DianValues }) {
  const [state, action, pending] = useActionState(saveDianSettings, null);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.name} className={`flex flex-col gap-2 ${f.wide ? "sm:col-span-2" : ""}`}>
            <Label htmlFor={`dian-${f.name}`}>{f.label}</Label>
            <Input
              id={`dian-${f.name}`}
              name={f.name}
              required={f.required}
              type={f.name === "software_pin" ? "password" : f.name === "email" ? "email" : "text"}
              autoComplete="off"
              defaultValue={values?.[f.name] ?? ""}
            />
            {f.hint ? <span className="text-xs text-muted-foreground">{f.hint}</span> : null}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar datos DIAN"}
        </Button>
        {state?.ok ? <span className="text-sm text-muted-foreground">Guardado.</span> : null}
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
