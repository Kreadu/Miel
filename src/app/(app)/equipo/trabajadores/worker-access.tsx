"use client";

import { useActionState } from "react";

import { clearWorkerPinAccess, setWorkerPinAccess } from "@/actions/workers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { InviteForm } from "../usuarios/invite-form";

/**
 * S21-03 (ADR-037): cómo entra el trabajador a Miel. Con código: en el equipo de la tienda
 * (modo tienda). Con correo: invitación con su categoría, desde cualquier lugar.
 */
export function WorkerAccess({
  workerId,
  username,
  hasEmailAccount,
  email,
  categoryId,
  categories,
}: {
  workerId: string;
  username: string | null;
  hasEmailAccount: boolean;
  email: string | null;
  categoryId: string | null;
  categories: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(setWorkerPinAccess, null);

  return (
    <section className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
      <h3 className="text-sm font-medium text-muted-foreground">Acceso a Miel</h3>

      <div className="flex flex-col gap-3">
        <p className="text-sm">
          <strong className="font-medium">Con código</strong>{" "}
          <span className="text-muted-foreground">
            (en el equipo de la tienda){username ? ` · usuario: ${username}` : " · sin código"}
          </span>
        </p>
        <form action={action} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-4">
          <input type="hidden" name="worker_id" value={workerId} />
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${workerId}-username`}>Usuario</Label>
            <Input
              id={`${workerId}-username`}
              name="username"
              required
              maxLength={30}
              autoComplete="off"
              autoCapitalize="none"
              defaultValue={username ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${workerId}-pin`}>Código (4 números)</Label>
            <Input
              id={`${workerId}-pin`}
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${workerId}-pin-confirm`}>Repite el código</Label>
            <Input
              id={`${workerId}-pin-confirm`}
              name="pin_confirm"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando…" : username ? "Cambiar código" : "Dar acceso con código"}
          </Button>
        </form>
        {state && !state.ok ? (
          <p role="alert" className="text-xs text-destructive">
            {state.error}
          </p>
        ) : null}
        {state?.ok ? <p className="text-xs text-muted-foreground">Acceso guardado.</p> : null}
        {username ? (
          <form action={clearWorkerPinAccess}>
            <input type="hidden" name="worker_id" value={workerId} />
            <Button type="submit" variant="ghost" size="sm">
              Quitar código
            </Button>
          </form>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm">
          <strong className="font-medium">Con correo</strong>{" "}
          <span className="text-muted-foreground">
            (desde cualquier lugar){hasEmailAccount ? " · ya tiene cuenta con correo" : ""}
          </span>
        </p>
        {hasEmailAccount ? null : (
          <InviteForm
            categories={categories}
            defaultEmail={email}
            defaultAccess={categoryId ?? "admin"}
            workerId={workerId}
          />
        )}
      </div>
    </section>
  );
}
