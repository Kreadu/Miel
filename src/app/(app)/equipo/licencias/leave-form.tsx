"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { createLeave } from "@/actions/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAVE_TYPE_IDS } from "@/lib/validation/payroll";

/** S21-05: registrar una licencia o incapacidad. */
export function LeaveForm({ workers }: { workers: { id: string; full_name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createLeave, null);
  const t = useTranslations();
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setOpen(false);
  }

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>{t("rrhh.leaves.add")}</Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="leave-worker">{t("rrhh.common.worker")}</Label>
          <Select name="worker_id" required>
            <SelectTrigger id="leave-worker" className="w-full">
              <SelectValue placeholder={t("rrhh.leaves.workerPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="leave-type">{t("rrhh.common.type")}</Label>
          <Select name="type" required>
            <SelectTrigger id="leave-type" className="w-full">
              <SelectValue placeholder={t("rrhh.leaves.typePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {LEAVE_TYPE_IDS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`rrhh.leaveTypes.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="leave-start">{t("rrhh.common.from")}</Label>
          <Input id="leave-start" name="start_date" type="date" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="leave-end">{t("rrhh.common.to")}</Label>
          <Input id="leave-end" name="end_date" type="date" required />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="leave-note">{t("rrhh.common.noteOptional")}</Label>
          <Input id="leave-note" name="note" maxLength={300} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("rrhh.common.saving") : t("rrhh.leaves.save")}
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
