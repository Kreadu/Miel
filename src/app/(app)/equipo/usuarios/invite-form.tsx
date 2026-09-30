"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { createInvitation } from "@/actions/invitations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * S21-03: invitación por correo. "Acceso" unifica rol y categoría: Administrador, Cuenta de la
 * tienda (la que usa el modo tienda) o una categoría de trabajador. Desde la ficha de un
 * trabajador llega con su correo y `workerId` para dejarlo enlazado.
 */
export function InviteForm({
  categories,
  defaultEmail,
  defaultAccess,
  workerId,
}: {
  categories: { id: string; name: string }[];
  defaultEmail?: string | null;
  defaultAccess?: string;
  workerId?: string;
}) {
  const [state, action, pending] = useActionState(createInvitation, null);
  // E20: el error llega como clave; el resto del formulario se traduce con RRHH (módulo 7).
  const tr = useTranslations();
  const [copied, setCopied] = useState(false);

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {workerId ? <input type="hidden" name="worker_id" value={workerId} /> : null}
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="email">Correo del invitado</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={defaultEmail ?? undefined}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="access">Acceso</Label>
          <Select name="access" defaultValue={defaultAccess ?? "admin"}>
            <SelectTrigger id="access" className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Administrador (ve todo)</SelectItem>
              <SelectItem value="tienda">Cuenta de la tienda (modo tienda)</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  Categoría: {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Invitando…" : "Invitar"}
        </Button>
      </form>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {tr(state.error)}
        </p>
      ) : null}
      {state && state.ok ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-2.5">
          <code className="flex-1 truncate text-xs text-muted-foreground">{state.link}</code>
          <Button type="button" variant="outline" size="sm" onClick={() => copyLink(state.link)}>
            {copied ? "Copiado" : "Copiar enlace"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
