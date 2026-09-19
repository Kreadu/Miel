"use client";

import { useState } from "react";
import { markSaleDelivered } from "@/actions/sales";
import { Button } from "@/components/ui/button";

export function DeliverSaleAction({ saleId, isShipped }: { saleId: string; isShipped: boolean }) {
  const [pending, setPending] = useState(false);

  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="h-7 text-xs w-full" 
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await markSaleDelivered(saleId);
        // El error no se maneja visiblemente aquí para mantener la interfaz limpia; 
        // podría agregarse un toast si fuera necesario.
        setPending(false);
      }}
    >
      {pending ? "..." : (isShipped ? "Marcar entregado" : "Entregar directamente")}
    </Button>
  );
}
