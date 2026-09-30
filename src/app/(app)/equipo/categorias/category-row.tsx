"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { deleteWorkerCategory, updateWorkerCategory } from "@/actions/workers";
import { Button } from "@/components/ui/button";
import { WORKER_MODULES } from "@/lib/rrhh/workers";

import { CategoryFields } from "./category-fields";

export function CategoryRow({
  id,
  name,
  modules,
  workerCount,
}: {
  id: string;
  name: string;
  modules: string[];
  workerCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateWorkerCategory, null);
  const t = useTranslations();
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setEditing(false);
  }

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          <CategoryFields idPrefix={id} name={name} modules={modules} />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? t("rrhh.common.saving") : t("rrhh.common.save")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              {t("rrhh.common.cancel")}
            </Button>
          </div>
          {state && !state.ok ? (
            <p role="alert" className="text-xs text-destructive">
              {t(state.error)}
            </p>
          ) : null}
        </form>
      </li>
    );
  }

  const labels = WORKER_MODULES.filter((m) => modules.includes(m.id)).map((m) => t(`rrhh.modules.${m.id}`));

  return (
    <li className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">
          {name} <span className="text-xs font-normal text-muted-foreground">· {t("rrhh.common.workersCount", { count: workerCount })}</span>
        </span>
        <span className="text-xs text-muted-foreground">
          {labels.length > 0 ? t("rrhh.categories.sees", { modules: labels.join(", ") }) : t("rrhh.categories.seesNothing")}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
          {t("rrhh.common.edit")}
        </Button>
        <form
          action={deleteWorkerCategory}
          onSubmit={(e) => {
            if (!confirm(t("rrhh.categories.deleteConfirm", { name }))) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="ghost" size="sm">
            {t("rrhh.common.remove")}
          </Button>
        </form>
      </div>
    </li>
  );
}
