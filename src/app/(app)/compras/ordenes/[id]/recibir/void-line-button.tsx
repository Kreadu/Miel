"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { voidPurchaseReceiptLine } from "@/actions/purchase-receipts";
import { Button } from "@/components/ui/button";

/** S28-01 (R6): anular una línea guardada por error (solo dueño/admin). */
export function VoidLineButton({ purchaseId, lineId }: { purchaseId: string; lineId: string }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-2">
      {error ? (
        <span role="alert" className="text-destructive">
          {t(error)}
        </span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm(t("purchases.receipt.voidConfirm"))) return;
          start(async () => {
            const res = await voidPurchaseReceiptLine(purchaseId, lineId);
            setError(res && !res.ok ? res.error : null);
          });
        }}
      >
        {pending ? "..." : t("purchases.receipt.void")}
      </Button>
    </span>
  );
}
