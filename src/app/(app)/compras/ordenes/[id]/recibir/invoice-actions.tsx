"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { voidPurchaseInvoice } from "@/actions/purchase-receipts";
import { Button } from "@/components/ui/button";

import { InvoiceForm, type InvoiceValues } from "./invoice-form";

/** S28-03: corregir una factura o anularla si no tiene líneas activas (solo dueño/admin). */
export function InvoiceActions({
  purchaseId,
  invoice,
  canVoid,
}: {
  purchaseId: string;
  invoice: InvoiceValues;
  canVoid: boolean;
}) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return <InvoiceForm purchaseId={purchaseId} invoice={invoice} onCancel={() => setEditing(false)} />;
  }

  return (
    <span className="flex flex-wrap items-center gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
        {t("purchases.receipt.correct")}
      </Button>
      {canVoid ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!confirm(t("purchases.receipt.voidInvoiceConfirm"))) return;
            start(async () => {
              const res = await voidPurchaseInvoice(purchaseId, invoice.id);
              setError(res && !res.ok ? res.error : null);
            });
          }}
        >
          {pending ? "..." : t("purchases.receipt.voidInvoice")}
        </Button>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {t(error)}
        </span>
      ) : null}
    </span>
  );
}
