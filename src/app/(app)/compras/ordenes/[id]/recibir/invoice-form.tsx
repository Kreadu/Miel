"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";

import { updatePurchaseInvoice } from "@/actions/purchase-receipts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { round2 } from "@/lib/money";

export type InvoiceValues = {
  id: string;
  number: string;
  issued_on: string;
  due_on: string | null;
  cufe: string | null;
  subtotal: number;
  tax: number;
};

/**
 * S28-03: corregir una factura ya recibida (p. ej. la impresa trae un flete o un redondeo). La
 * bodega no cambia; sin archivo nuevo conserva el suyo. Recibir es `ReceiveInvoiceForm` (S28-04).
 */
export function InvoiceForm({
  purchaseId,
  invoice,
  onCancel,
}: {
  purchaseId: string;
  invoice: InvoiceValues;
  onCancel: () => void;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(updatePurchaseInvoice, null);
  const [subtotal, setSubtotal] = useState(String(invoice.subtotal));
  const [tax, setTax] = useState(String(invoice.tax));
  const total = round2((Number(subtotal) || 0) + (Number(tax) || 0));
  const id = (name: string) => `${name}-${invoice.id}`;
  // Corrección guardada: se cierra el formulario (la página ya se revalidó).
  useEffect(() => {
    if (state?.ok) onCancel();
  }, [state, onCancel]);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <input type="hidden" name="invoice_id" value={invoice.id} />
      <input type="hidden" name="purchase_id" value={purchaseId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("number")}>{t("purchases.receipt.number")}</Label>
          <Input id={id("number")} name="number" required maxLength={60} defaultValue={invoice.number} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("cufe")}>{t("purchases.receipt.cufe")}</Label>
          <Input id={id("cufe")} name="cufe" maxLength={200} defaultValue={invoice.cufe ?? undefined} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("issued")}>{t("purchases.receipt.issued")}</Label>
          <Input id={id("issued")} name="issued_on" type="date" required defaultValue={invoice.issued_on} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("due")}>{t("purchases.receipt.due")}</Label>
          <Input id={id("due")} name="due_on" type="date" defaultValue={invoice.due_on ?? undefined} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("subtotal")}>{t("purchases.receipt.subtotal")}</Label>
          <Input
            id={id("subtotal")}
            name="subtotal"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            required
            value={subtotal}
            onChange={(e) => setSubtotal(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("tax")}>{t("purchases.receipt.tax")}</Label>
          <Input
            id={id("tax")}
            name="tax"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            required
            value={tax}
            onChange={(e) => setTax(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={id("file")}>{t("purchases.receipt.replaceFile")}</Label>
          <Input
            id={id("file")}
            name="file"
            type="file"
            accept="application/pdf,.pdf,.xml,text/xml,application/xml,.zip,application/zip,image/jpeg,image/png,image/webp"
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          {t("purchases.receipt.total")}: <span className="font-semibold tabular-nums">${formatMoney(total)}</span>
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
            {t("purchases.cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? t("purchases.receipt.saving") : t("purchases.receipt.saveCorrection")}
          </Button>
        </div>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}
