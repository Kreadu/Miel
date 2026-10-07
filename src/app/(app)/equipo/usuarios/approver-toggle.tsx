"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { setPurchaseApprover } from "@/actions/purchases";

/** S26-02: el dueño marca qué admins aprueban órdenes de compra. */
export function ApproverToggle({ membershipId, checked }: { membershipId: string; checked: boolean }) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(checked);
  const [error, setError] = useState<string | null>(null);
  const id = `approver-${membershipId}`;

  return (
    <div className="flex flex-col items-end gap-1">
      <label htmlFor={id} className="flex min-h-10 items-center gap-2 text-xs text-muted-foreground">
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={value}
          disabled={pending}
          onChange={(e) => {
            const next = e.currentTarget.checked;
            setValue(next);
            startTransition(async () => {
              const res = await setPurchaseApprover(membershipId, next);
              const failed = !res || !res.ok;
              setError(res && !res.ok ? res.error : null);
              // Si la BD no lo guardó, la casilla vuelve a lo que de verdad quedó.
              if (failed) setValue(!next);
            });
          }}
        />
        {t("purchases.approval.approver")}
      </label>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}
