"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { createWorker } from "@/actions/workers";
import { Button } from "@/components/ui/button";

import { type WorkerArea, WorkerFields } from "./worker-fields";

type Option = { id: string; name: string };

export function WorkerForm({
  area,
  categories,
  positions,
  warehouses,
}: {
  area: WorkerArea;
  categories: Option[];
  positions: Option[];
  warehouses: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createWorker, null);
  const t = useTranslations();
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setOpen(false);
  }

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>
          {area === "planta" ? t("rrhh.workers.add") : t("rrhh.workers.addTemporary")}
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <WorkerFields
        idPrefix="new"
        area={area}
        categories={categories}
        positions={positions}
        warehouses={warehouses}
      />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("rrhh.common.saving") : t("rrhh.workers.saveWorker")}
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
