"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";

import { deleteWorker, toggleWorkerActive, updateWorker } from "@/actions/workers";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/format";

import { WorkerAccess } from "./worker-access";
import { type WorkerArea, WorkerFields, type WorkerValues } from "./worker-fields";

type Option = { id: string; name: string };

export function WorkerRow({
  id,
  area,
  active,
  values,
  categories,
  positions,
  warehouses,
}: {
  id: string;
  area: WorkerArea;
  active: boolean;
  values: WorkerValues;
  categories: Option[];
  positions: Option[];
  warehouses: Option[];
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateWorker, null);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setEditing(false);
  }
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const t = useTranslations();

  function handleDelete() {
    if (!confirm(t("rrhh.workers.deleteConfirm", { name: values.full_name }))) return;
    startDelete(async () => {
      const result = await deleteWorker(id);
      if (!result.ok) setDeleteError(result.error);
    });
  }

  if (editing) {
    return (
      <li className="px-4 py-4">
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          <WorkerFields
            idPrefix={id}
            area={area}
            values={values}
            categories={categories}
            positions={positions}
            warehouses={warehouses}
          />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? t("rrhh.common.saving") : t("rrhh.common.save")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              {t("rrhh.common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="ml-auto"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? t("rrhh.workers.deleting") : t("rrhh.workers.deleteWorker")}
            </Button>
          </div>
          {state && !state.ok ? (
            <p role="alert" className="text-xs text-destructive">
              {t(state.error)}
            </p>
          ) : null}
          {deleteError ? (
            <p role="alert" className="text-xs text-destructive">
              {t(deleteError)}
            </p>
          ) : null}
        </form>
        {/* Fuera del form del trabajador: sus propios formularios no pueden ir anidados. */}
        <WorkerAccess
          workerId={id}
          username={values.username ?? null}
          hasEmailAccount={Boolean(values.user_id)}
          email={values.email}
          categoryId={values.category_id}
          categories={categories}
        />
      </li>
    );
  }

  const category = categories.find((c) => c.id === values.category_id)?.name;
  const access =
    values.username && values.user_id
      ? t("rrhh.workers.accessBoth")
      : values.username
        ? t("rrhh.workers.accessCode")
        : values.user_id
          ? t("rrhh.workers.accessEmail")
          : null;
  const position = positions.find((p) => p.id === values.position_id)?.name;
  const pay =
    values.worker_type === "por_horas"
      ? t("rrhh.workers.hourlyPay", { amount: formatMoney(values.hourly_rate) })
      : t("rrhh.workers.salaryPay", { amount: formatMoney(values.salary) });

  return (
    <li className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={active ? "font-medium" : "text-muted-foreground line-through"}>
          {values.full_name}
          {category ? (
            <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-secondary-foreground">
              {category}
            </span>
          ) : null}
        </span>
        <span className="text-xs text-muted-foreground">
          {[
            position,
            area === "planta"
              ? t(`rrhh.contractTypes.${values.contract_type}`)
              : t(`rrhh.workerTypes.${values.worker_type}`),
            pay,
            values.worker_type === "temporal" && values.end_date ? t("rrhh.workers.until", { date: formatDate(values.end_date) }) : null,
            values.cost_classification ? t(`rrhh.costClassifications.${values.cost_classification}`) : null,
            access ? t("rrhh.workers.entersWith", { access }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {active ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {t("rrhh.common.edit")}
          </Button>
        ) : null}
        <form
          action={toggleWorkerActive}
          onSubmit={(e) => {
            if (active && !confirm(t("rrhh.workers.retireConfirm", { name: values.full_name }))) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="active" value={(!active).toString()} />
          <Button type="submit" variant="ghost" size="sm">
            {active ? t("rrhh.workers.retire") : t("rrhh.workers.reactivate")}
          </Button>
        </form>
      </div>
    </li>
  );
}
