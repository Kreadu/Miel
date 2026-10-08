"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type ActionResult = { ok: boolean } | null;

/**
 * S26-07: formulario en modo lectura → "Editar" → "Guardar"/"Cancelar" (mismo patrón que la bodega
 * principal, S19-38). Al guardar bien vuelve a lectura; "Cancelar" remonta los campos (`formKey`)
 * con los valores guardados.
 */
export function useEditMode(state: ActionResult) {
  const [editing, setEditing] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setEditing(false);
  }
  return {
    editing,
    formKey,
    edit: () => setEditing(true),
    cancel: () => {
      setEditing(false);
      setFormKey((k) => k + 1);
    },
  };
}

export function EditActions({
  editing,
  pending,
  saved,
  onEdit,
  onCancel,
}: {
  editing: boolean;
  pending: boolean;
  saved: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("common");
  return editing ? (
    <div className="flex items-center gap-2">
      {/* key distinto: si React reusara el mismo <button>, el clic en "Editar" lo vería ya como
          submit y guardaría al instante. */}
      <Button key="save" type="submit" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
      <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
        {t("cancel")}
      </Button>
    </div>
  ) : (
    <div className="flex items-center gap-3">
      <Button key="edit" type="button" variant="outline" onClick={onEdit}>
        {t("edit")}
      </Button>
      {saved ? <span className="text-sm text-muted-foreground">{t("saved")}</span> : null}
    </div>
  );
}
