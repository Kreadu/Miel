"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { saveFiscalSettings } from "@/actions/fiscal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** S23-01: tipo de persona (exoneración 114-1 en nómina) y tarifa de renta (renta estimada). */
export function FiscalForm({ personType, incomeTaxRate }: { personType: string; incomeTaxRate: number }) {
  const [state, action, pending] = useActionState(saveFiscalSettings, null);
  const t = useTranslations();

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{t("results.fiscal.title")}</h2>
        <p className="text-xs text-muted-foreground">
          {t("results.fiscal.help")}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="person_type">{t("results.fiscal.personType")}</Label>
          <Select name="person_type" defaultValue={personType}>
            <SelectTrigger id="person_type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="juridica">{t("results.fiscal.juridica")}</SelectItem>
              <SelectItem value="natural">{t("results.fiscal.natural")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="income_tax_rate">{t("results.fiscal.rate")}</Label>
          <Input
            id="income_tax_rate"
            name="income_tax_rate"
            type="number"
            min={0}
            max={100}
            step="0.01"
            required
            defaultValue={incomeTaxRate}
            className="text-right"
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? t("results.fiscal.saving") : t("results.fiscal.save")}
        </Button>
      </div>
      {state && (
        <p role="status" className={`text-xs ${state.ok ? "text-muted-foreground" : "text-destructive"}`}>
          {state.ok ? t("results.fiscal.saved") : t(state.error)}
        </p>
      )}
    </form>
  );
}
