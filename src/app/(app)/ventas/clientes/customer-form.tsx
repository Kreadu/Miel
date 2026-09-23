"use client";

import { useActionState, useState } from "react";

import { type CustomerState } from "@/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CustomerFormValues = {
  id: string;
  name: string;
  doc_type: string;
  doc_number: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  active: boolean;
};

export function CustomerForm({
  action,
  values,
  submitLabel,
  pendingLabel,
  onCancel,
  onSuccess,
}: {
  action: (state: CustomerState, formData: FormData) => Promise<CustomerState>;
  values?: Partial<CustomerFormValues>;
  submitLabel: string;
  pendingLabel: string;
  onCancel?: () => void;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, null);
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" required maxLength={120} defaultValue={values?.name} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="doc_type">Tipo Doc.</Label>
          <select
            id="doc_type"
            name="doc_type"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            defaultValue={values?.doc_type ?? "nit"}
          >
            <option value="nit">NIT</option>
            <option value="cc">CC</option>
            <option value="ce">CE</option>
            <option value="other">Otro</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="doc_number">Número Doc.</Label>
          <Input id="doc_number" name="doc_number" maxLength={30} defaultValue={values?.doc_number ?? ""} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            maxLength={160}
            defaultValue={values?.email ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" name="phone" maxLength={30} defaultValue={values?.phone ?? ""} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4">
          <Label htmlFor="address">Dirección</Label>
          <Input
            id="address"
            name="address"
            maxLength={200}
            defaultValue={values?.address ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4">
          <Label htmlFor="note">Nota</Label>
          <textarea 
            id="note" 
            name="note" 
            maxLength={500} 
            defaultValue={values?.note ?? ""}
            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
            rows={2}
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
