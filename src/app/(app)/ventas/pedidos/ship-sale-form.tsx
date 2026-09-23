"use client";

import { useState } from "react";
import { markSaleShipped } from "@/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ShipSaleForm({ saleId }: { saleId: string }) {
  const [shipping, setShipping] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (shipping) {
    return (
      <form
        className="flex flex-col gap-2 min-w-[200px]"
        action={async (formData) => {
          setPending(true);
          setError(null);
          const address = formData.get("shipping_address") as string;
          const res = await markSaleShipped(saleId, address);
          if (!res?.ok) {
            setError(res?.error || "Error desconocido");
            setPending(false);
          } else {
            setShipping(false);
          }
        }}
      >
        <Input 
          name="shipping_address" 
          placeholder="Dirección de envío..." 
          required 
          className="h-8 text-xs" 
        />
        <div className="flex gap-1">
          <Button type="submit" size="sm" disabled={pending} className="h-7 text-xs flex-1">
            {pending ? "..." : "Guardar"}
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            disabled={pending} 
            className="h-7 text-xs flex-1" 
            onClick={() => setShipping(false)}
          >
            Cancelar
          </Button>
        </div>
        {error && <p className="text-[10px] text-destructive leading-tight">{error}</p>}
      </form>
    );
  }

  return (
    <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={() => setShipping(true)}>
      Despachar
    </Button>
  );
}
