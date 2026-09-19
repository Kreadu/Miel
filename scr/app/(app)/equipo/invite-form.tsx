"use client";

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

export function InviteForm() {
  const [state, action, pending] = useActionState(createInvitation, null);
  const [copied, setCopied] = useState(false);

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="email">Correo del invitado</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="role">Rol</Label>
          <Select name="role" defaultValue="member">
            <SelectTrigger id="role" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Operativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Invitando…" : "Invitar"}
        </Button>
      </form>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
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
