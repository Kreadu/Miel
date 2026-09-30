"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { refundSale } from "@/actions/sales";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** S18-08: confirma la devolución de la venta encontrada (motivo obligatorio). */
export function RefundForm({ receiptNumber }: { receiptNumber: number }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(refundSale, null);

  if (state?.ok) {
    return <p className="text-sm font-medium text-success">{t("cash.refund.done")}</p>;
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(t("cash.refund.confirm", { number: receiptNumber }))) e.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="receipt_number" value={receiptNumber} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="refund-reason">{t("cash.refund.reason")}</Label>
        <textarea
          id="refund-reason"
          name="reason"
          required
          maxLength={300}
          rows={2}
          placeholder={t("cash.refund.reasonPlaceholder")}
          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? t("cash.refund.refunding") : t("cash.refund.submit")}
        </Button>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}
