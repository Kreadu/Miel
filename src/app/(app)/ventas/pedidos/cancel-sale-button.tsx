"use client";

import { useState, useTransition } from "react";

import { cancelSale } from "@/actions/sales";
import { Button } from "@/components/ui/button";

/** S23-01: anular una venta (owner/admin). Pide confirmación: devuelve stock y cobros. */
export function CancelSaleButton({ saleId }: { saleId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-full text-xs text-destructive"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("¿Anular esta venta? El stock vuelve al inventario y los cobros se registran como devolución."))
            return;
          startTransition(async () => {
            const r = await cancelSale(saleId);
            setError(r && !r.ok ? r.error : null);
          });
        }}
      >
        {pending ? "Anulando…" : "Anular venta"}
      </Button>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
