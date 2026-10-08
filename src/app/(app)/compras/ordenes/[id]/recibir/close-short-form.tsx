"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { closePurchaseShort } from "@/actions/purchase-receipts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** S28-01 (R4): el proveedor no mandará el resto → la orden se cierra con faltantes. */
export function CloseShortForm({ purchaseId }: { purchaseId: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(closePurchaseShort, null);

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        {t("purchases.receipt.closeShort")}
      </Button>
    );
  }

  return (
    <form action={action} className="flex w-full flex-col gap-2 sm:max-w-sm">
      <input type="hidden" name="purchase_id" value={purchaseId} />
      <Label htmlFor="short-note">{t("purchases.receipt.shortNote")}</Label>
      <Input id="short-note" name="note" maxLength={500} placeholder={t("purchases.receipt.shortNotePlaceholder")} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("purchases.receipt.saving") : t("purchases.receipt.confirmCloseShort")}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          {t("purchases.cancel")}
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
