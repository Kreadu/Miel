"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { cancelSale } from "@/actions/sales";
import { Button } from "@/components/ui/button";

/**
 * S23-01/S18-08: anular una venta sin cobros (owner/admin), con confirmación; devuelve el stock.
 * Si ya tiene cobros, el dinero está en la caja: se devuelve desde Caja (link con su boleta).
 */
export function CancelSaleButton({
  saleId,
  paid,
  receiptNumber,
}: {
  saleId: string;
  paid: number;
  receiptNumber: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations();

  if (paid > 0) {
    return (
      <Link
        href={receiptNumber ? `/ventas/caja?boleta=${receiptNumber}` : "/ventas/caja"}
        className="text-right text-xs text-muted-foreground underline underline-offset-4"
      >
        {t("sales.orders.refundInCash")}
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-full text-xs text-destructive"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(t("sales.orders.cancelConfirm")))
            return;
          startTransition(async () => {
            const r = await cancelSale(saleId);
            setError(r && !r.ok ? r.error : null);
          });
        }}
      >
        {pending ? t("sales.orders.cancelling") : t("sales.orders.cancelSale")}
      </Button>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-destructive">
          {t(error)}
        </p>
      )}
    </div>
  );
}
