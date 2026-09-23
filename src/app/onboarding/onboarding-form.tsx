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
