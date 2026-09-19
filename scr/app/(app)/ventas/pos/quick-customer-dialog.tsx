"use client";

import { useActionState, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";

import { createCustomer } from "@/actions/customers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Alta rápida de cliente desde el POS (S15-02/ADR-033). Visible a los 3 roles: `member` ya
 * puede vender, y ahora también crear el cliente al que le vende (editar/archivar sigue
 * admin-only, RLS de update sin cambios).
 */
export function QuickCustomerDialog({
  onCreated,
}: {
  onCreated: (customer: { id: string; name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createCustomer, null);
  const [seenState, setSeenState] = useState(state);

  // Cerrar el propio modal es estado del propio componente: se ajusta en render (patrón ya
  // usado en customer-form.tsx). Avisar al padre (PosTerminal) es una escritura de OTRO
  // componente — hacerla en el mismo render dispara "Cannot update a component while
  // rendering a different component" (mismo hallazgo que S13-02 documentó con router.push),
  // así que ese aviso va en un efecto aparte.
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setOpen(false);
  }

  useEffect(() => {
    if (state?.ok && state.customer) onCreated(state.customer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <UserPlus className="size-4" />
          Nuevo cliente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="quick-customer-name">Nombre</Label>
            <Input id="quick-customer-name" name="name" required maxLength={120} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="quick-customer-doc-type">Tipo Doc.</Label>
              <select
                id="quick-customer-doc-type"
                name="doc_type"
                className={SELECT_CLASS}
                defaultValue="nit"
              >
                <option value="nit">NIT</option>
                <option value="cc">CC</option>
                <option value="ce">CE</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="quick-customer-doc-number">Número Doc.</Label>
              <Input id="quick-customer-doc-number" name="doc_number" maxLength={30} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="quick-customer-phone">Teléfono</Label>
            <Input id="quick-customer-phone" name="phone" maxLength={30} />
          </div>
          {state && !state.ok ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creando..." : "Crear cliente"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
