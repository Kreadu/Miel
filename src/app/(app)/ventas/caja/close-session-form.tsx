"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { closeCashSession } from "@/actions/cash-sessions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CloseSessionForm({ sessionId }: { sessionId: string }) {
  const [state, formAction, pending] = useActionState(closeCashSession, null);
  const t = useTranslations();

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <input type="hidden" name="session_id" value={sessionId} />
      <div className="flex flex-col gap-2 max-w-xs">
        <Label htmlFor="counted_amount">{t("cash.countedAmount")}</Label>
        <Input id="counted_amount" name="counted_amount" type="number" step="0.01" min="0" required />
        <p className="text-xs text-muted-foreground">
          {t("cash.countedHelp")}
        </p>
      </div>
      <div className="flex flex-col gap-2 max-w-sm">
        <Label htmlFor="note">{t("cash.noteOptional")}</Label>
        <textarea
          id="note"
          name="note"
          maxLength={500}
          rows={2}
          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
        />
      </div>
      <div>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? t("cash.closing") : t("cash.closeCash")}
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
