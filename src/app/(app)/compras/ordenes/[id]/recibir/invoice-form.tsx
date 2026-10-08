"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";

import { createPurchaseInvoice, updatePurchaseInvoice } from "@/actions/purchase-receipts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
 * S28-01: datos de la factura del proveedor (y su archivo si es digital).
 * S28-03: con `invoice`, corrige esa factura (la bodega no cambia; sin archivo nuevo conserva el suyo).
 */
export function InvoiceForm({
  purchaseId,
  warehouses = [],
  invoice,
  onCancel,
}: {
  purchaseId: string;
  warehouses?: { id: string; name: string }[];
  invoice?: InvoiceValues;
  onCancel?: () => void;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(invoice ? updatePurchaseInvoice : createPurchaseInvoice, null);
  const [subtotal, setSubtotal] = useState(invoice ? String(invoice.subtotal) : "");
  const [tax, setTax] = useState(invoice ? String(invoice.tax) : "");
  const p = (id: string) => (invoice ? `${id}-${invoice.id}` : id);
  // Corrección guardada: se cierra el formulario (la página ya se revalidó).
  useEffect(() => {
    if (state?.ok) onCancel?.();
  }, [state, onCancel]);
  const total = round2((Number(subtotal) || 0) + (Number(tax) || 0));

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      {invoice ? (
        <input type="hidden" name="invoice_id" value={invoice.id} />
      ) : (
        <div>
          <h2 className="text-base font-semibold tracking-tight">{t("purchases.receipt.invoiceTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("purchases.receipt.invoiceHelp")}</p>
        </div>
      )}
      <input type="hidden" name="purchase_id" value={purchaseId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={p("inv-number")}>{t("purchases.receipt.number")}</Label>
          <Input id={p("inv-number")} name="number" required maxLength={60} placeholder="FE-123" defaultValue={invoice?.number} />
        </div>
        {invoice ? null : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-warehouse">{t("purchases.receipt.warehouse")}</Label>
            <Select name="warehouse_id" required defaultValue={warehouses.length === 1 ? warehouses[0].id : undefined}>
              <SelectTrigger id="inv-warehouse" className="w-full">
                <SelectValue placeholder={t("purchases.warehousePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={p("inv-issued")}>{t("purchases.receipt.issued")}</Label>
          <Input id={p("inv-issued")} name="issued_on" type="date" required defaultValue={invoice?.issued_on} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={p("inv-due")}>{t("purchases.receipt.due")}</Label>
          <Input id={p("inv-due")} name="due_on" type="date" defaultValue={invoice?.due_on ?? undefined} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={p("inv-subtotal")}>{t("purchases.receipt.subtotal")}</Label>
          <Input
            id={p("inv-subtotal")}
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
          <Label htmlFor={p("inv-tax")}>{t("purchases.receipt.tax")}</Label>
          <Input
            id={p("inv-tax")}
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={p("inv-cufe")}>{t("purchases.receipt.cufe")}</Label>
          <Input id={p("inv-cufe")} name="cufe" maxLength={200} defaultValue={invoice?.cufe ?? undefined} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={p("inv-file")}>{invoice ? t("purchases.receipt.replaceFile") : t("purchases.receipt.file")}</Label>
          <Input
            id={p("inv-file")}
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
          {onCancel ? (
            <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
              {t("purchases.cancel")}
            </Button>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending
              ? t("purchases.receipt.saving")
              : invoice
                ? t("purchases.receipt.saveCorrection")
                : t("purchases.receipt.saveInvoice")}
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
