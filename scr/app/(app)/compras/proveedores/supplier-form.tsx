"use client";

import { useActionState, useState } from "react";

import { type SupplierState } from "@/actions/suppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SupplierFormValues = {
  id: string;
  name: string;
  nit: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  active: boolean;
};

export function SupplierForm({
  action,
  values,
  submitLabel,
  pendingLabel,
  onCancel,
  onSuccess,
}: {
  action: (state: SupplierState, formData: FormData) => Promise<SupplierState>;
  values?: Partial<SupplierFormValues>;
  submitLabel: string;
  pendingLabel: string;
  onCancel?: () => void;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  // Ajuste de estado durante el render (patrón oficial de React, no un efecto — S2-01): al ver
  // un `state` de éxito nuevo, notifica al padre (p. ej. cerrar el modo edición).
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) onSuccess?.();
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" required maxLength={120} defaultValue={values?.name} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nit">NIT</Label>
          <Input id="nit" name="nit" maxLength={30} defaultValue={values?.nit ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            maxLength={160}
            defaultValue={values?.email ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" name="phone" maxLength={30} defaultValue={values?.phone ?? ""} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="address">Dirección</Label>
          <Input
            id="address"
            name="address"
            maxLength={200}
            defaultValue={values?.address ?? ""}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
