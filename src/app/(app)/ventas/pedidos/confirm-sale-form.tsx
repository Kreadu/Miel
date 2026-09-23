"use client";

import { useState } from "react";

import { confirmSale } from "@/actions/sales";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ConfirmSaleForm({
  saleId,
  warehouses,
}: {
  saleId: string;
  warehouses: { id: string; name: string }[];
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (confirming) {
    return (
      <form
        className="flex flex-col gap-2 min-w-[200px]"
        action={async (formData) => {
          setPending(true);
          setError(null);
          const warehouseId = formData.get("warehouse_id") as string;
          const res = await confirmSale(saleId, warehouseId);
          if (!res?.ok) {
            setError(res?.error || "Error desconocido");
            setPending(false);
          } else {
            setConfirming(false);
          }
        }}
      >
        <Select name="warehouse_id" required>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Bodega origen..." />
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
          <Button type="button" variant="ghost" size="sm" disabled={pending} className="h-7 text-xs flex-1" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
        </div>
        {error && <p className="text-[10px] text-destructive leading-tight">{error}</p>}
      </form>
    );
  }

  return (
    <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={() => setConfirming(true)}>
      Confirmar
    </Button>
  );
}
