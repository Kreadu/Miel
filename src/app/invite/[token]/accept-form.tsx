"use client";

import { useActionState } from "react";

import { acceptInvitation } from "@/actions/invitations";
import { Button } from "@/components/ui/button";

export function AcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Uniéndote…" : "Aceptar invitación y unirme"}
      </Button>
    </form>
  );
}
