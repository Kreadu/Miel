"use client";

import { useState } from "react";

import { cancelPurchase } from "@/actions/purchases";
import { Button } from "@/components/ui/button";

export function CancelPurchaseAction({ purchaseId }: { purchaseId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs w-full text-destructive hover:text-destructive"
        disabled={pending}
        onClick={async () => {
          if (!confirm("¿Cancelar esta orden de compra?")) return;
          setPending(true);
          setError(null);
          const res = await cancelPurchase(purchaseId);
          if (!res?.ok) setError(res?.error || "Error desconocido");
          setPending(false);
        }}
      >
        {pending ? "..." : "Cancelar"}
      </Button>
      {error && <p className="text-[10px] text-destructive leading-tight">{error}</p>}
    </div>
  );
}
