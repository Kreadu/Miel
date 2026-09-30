"use client";

import { useActionState } from "react";

import { saveFiscalSettings } from "@/actions/fiscal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** S23-01: tipo de persona (exoneración 114-1 en nómina) y tarifa de renta (renta estimada). */
export function FiscalForm({ personType, incomeTaxRate }: { personType: string; incomeTaxRate: number }) {
  const [state, action, pending] = useActionState(saveFiscalSettings, null);

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Datos fiscales de la empresa</h2>
        <p className="text-xs text-muted-foreground">
          Definen la exoneración de aportes en la nómina (art. 114-1) y la renta estimada.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="person_type">Tipo de persona</Label>
          <Select name="person_type" defaultValue={personType}>
            <SelectTrigger id="person_type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="juridica">Persona jurídica</SelectItem>
              <SelectItem value="natural">Persona natural</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="income_tax_rate">Tarifa de renta (%)</Label>
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
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
      {state && (
        <p role="status" className={`text-xs ${state.ok ? "text-muted-foreground" : "text-destructive"}`}>
          {state.ok ? "Guardado." : state.error}
        </p>
      )}
    </form>
  );
}
