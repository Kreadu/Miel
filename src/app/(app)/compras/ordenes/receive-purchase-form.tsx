"use client";

import { useState } from "react";

import { receivePurchase } from "@/actions/purchases";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ReceivePurchaseForm({
  purchaseId,
  warehouses,
}: {
  purchaseId: string;
  warehouses: { id: string; name: string }[];
}) {
  const [receiving, setReceiving] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (receiving) {
    return (
      <form
        className="flex flex-col gap-2 min-w-[200px]"
        action={async (formData) => {
          setPending(true);
          setError(null);
          const warehouseId = formData.get("warehouse_id") as string;
          const res = await receivePurchase(purchaseId, warehouseId);
          if (!res?.ok) {
            setError(res?.error || "Error desconocido");
            setPending(false);
          } else {
            setReceiving(false);
          }
        }}
      >
        <Select name="warehouse_id" required defaultValue={warehouses.length === 1 ? warehouses[0].id : undefined}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Bodega destino..." />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id} className="text-xs">
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Button type="submit" size="sm" disabled={pending} className="h-7 text-xs flex-1">
            {pending ? "..." : "Confirmar"}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={pending} className="h-7 text-xs flex-1" onClick={() => setReceiving(false)}>
            Cancelar
          </Button>
        </div>
        {error && <p className="text-[10px] text-destructive leading-tight">{error}</p>}
      </form>
    );
  }

  return (
    <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={() => setReceiving(true)}>
      Recibir
    </Button>
  );
}
