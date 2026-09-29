"use client";

import { useActionState } from "react";

import { createTenant } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createTenant, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre de la empresa</Label>
        <Input id="name" name="name" autoComplete="organization" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="nit">NIT (opcional)</Label>
        <Input id="nit" name="nit" />
      </div>
      <div className="flex flex-col gap-2">
        <Label>¿Cómo vende tu empresa?</Label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="sellsPhysical"
            defaultChecked
            className="h-4 w-4 accent-primary"
          />
          Local físico (caja, sucursal)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sellsVirtual" className="h-4 w-4 accent-primary" />
          Catálogo online
        </label>
        <p className="text-xs text-muted-foreground">Elige al menos una opción.</p>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creando…" : "Crear empresa"}
      </Button>
    </form>
  );
}
