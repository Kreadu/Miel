"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { createWorkerPosition } from "@/actions/workers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PositionForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createWorkerPosition, null);
  const t = useTranslations();
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setOpen(false);
  }

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>{t("rrhh.positions.add")}</Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-col gap-2 sm:max-w-sm">
        <Label htmlFor="new-position">{t("rrhh.positions.name")}</Label>
        <Input id="new-position" name="name" required maxLength={80} placeholder={t("rrhh.common.positionPlaceholder")} />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("rrhh.common.creating") : t("rrhh.positions.create")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t("rrhh.common.cancel")}
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
