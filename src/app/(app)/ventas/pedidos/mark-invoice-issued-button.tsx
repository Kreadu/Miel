"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { markInvoiceIssued } from "@/actions/sales";
import { Button } from "@/components/ui/button";

/** S18-06: el dueño ya emitió la factura en su sistema de facturación. */
export function MarkInvoiceIssuedButton({ saleId }: { saleId: string }) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await markInvoiceIssued(saleId);
            setError(r && !r.ok ? r.error : null);
          })
        }
      >
        {pending ? t("sales.orders.marking") : t("sales.orders.markIssued")}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}
