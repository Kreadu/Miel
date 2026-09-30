"use client";

import { useActionState } from "react";

import { identifyWorker } from "@/actions/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** S21-03: el trabajador se identifica en el equipo de la tienda. */
export function PinForm() {
  const [state, action, pending] = useActionState(identifyWorker, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="username">Usuario</Label>
        <Input id="username" name="username" required maxLength={30} autoComplete="off" autoCapitalize="none" autoFocus />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="pin">Código de 4 dígitos</Label>
        <Input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          required
          autoComplete="off"
          className="text-center text-2xl tracking-[0.5em]"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Verificando…" : "Entrar"}
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
