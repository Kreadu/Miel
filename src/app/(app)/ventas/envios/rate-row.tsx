"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { deleteShippingRate, updateShippingRate } from "@/actions/shipping";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";

import { RateFields, type RateValues } from "./rate-fields";

export function RateRow({
  id,
  values,
  canManage,
}: {
  id: string;
  values: RateValues;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateShippingRate, null);
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
          <RateFields idPrefix={id} values={values} />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? t("shipping.saving") : t("shipping.save")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              {t("shipping.cancel")}
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

  return (
    <li className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{values.name}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("shipping.summary", {
            base: formatMoney(values.base_price),
            kg: formatMoney(values.price_per_kg),
            km: formatMoney(values.price_per_km),
          })}
        </span>
      </div>
      {canManage ? (
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {t("shipping.edit")}
          </Button>
          <form
            action={deleteShippingRate}
            onSubmit={(e) => {
              if (!confirm(t("shipping.deleteConfirm", { name: values.name }))) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="ghost" size="sm">
              {t("shipping.delete")}
            </Button>
          </form>
        </div>
      ) : null}
    </li>
  );
}
