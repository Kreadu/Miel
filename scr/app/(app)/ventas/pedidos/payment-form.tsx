"use client";

import { useState } from "react";

import { registerCustomerPayment } from "@/actions/customer-payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  other: "Otro",
};

export function PaymentForm({
  saleId,
  customerId,
  balance,
}: {
  saleId: string;
  customerId: string;
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={() => setOpen(true)}>
        Registrar cobro
      </Button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 min-w-[200px]"
      action={async (formData) => {
        setPending(true);
        setError(null);
        const res = await registerCustomerPayment(null, formData);
        if (!res?.ok) {
          setError(res?.error || "Error desconocido");
          setPending(false);
        } else {
          setOpen(false);
        }
      }}
    >
      <input type="hidden" name="sale_id" value={saleId} />
      <input type="hidden" name="customer_id" value={customerId} />
      <Input
        name="amount"
        type="number"
        step="0.01"
        min="0.01"
        max={balance}
        placeholder={`Máx. ${balance.toFixed(2)}`}
        required
        className="h-8 text-xs"
      />
      <Select name="method" required defaultValue="cash">
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Método..." />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(METHOD_LABEL).map(([value, label]) => (
            <SelectItem key={value} value={value} className="text-xs">
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-1">
        <Button type="submit" size="sm" disabled={pending} className="h-7 text-xs flex-1">
          {pending ? "..." : "Cobrar"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} className="h-7 text-xs flex-1" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
      {error && <p className="text-[10px] text-destructive leading-tight">{error}</p>}
    </form>
  );
}
