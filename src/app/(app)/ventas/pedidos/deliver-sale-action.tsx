"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { markSaleDelivered } from "@/actions/sales";
import { Button } from "@/components/ui/button";

export function DeliverSaleAction({ saleId, isShipped }: { saleId: string; isShipped: boolean }) {
  const [pending, setPending] = useState(false);
  const t = useTranslations("sales.orders");

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
      {pending ? "..." : (isShipped ? t("markDelivered") : t("deliverDirectly"))}
    </Button>
  );
}
