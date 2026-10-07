"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { saveStoreSettings } from "@/actions/online-store";
import { EditActions, useEditMode } from "@/components/edit-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_STORE_COLOR } from "@/lib/store/color";

type Values = { store_enabled: boolean; store_slug: string | null; store_color: string | null };

/** S27-01: activar la tienda en línea, su dirección y su color (solo dueño/admin). */
export function StoreSettingsForm({ values }: { values: Values }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(saveStoreSettings, null);
  const mode = useEditMode(state);
  const [copied, setCopied] = useState(false);
  const path = values.store_slug ? `/tienda/${values.store_slug}` : null;

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{t("onlineStore.settings.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("onlineStore.settings.subtitle")}</p>
      </div>

      <fieldset key={mode.formKey} disabled={!mode.editing} className="contents">
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={values.store_enabled} className="h-4 w-4 accent-primary" />
        {t("onlineStore.settings.enabled")}
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="store-slug">{t("onlineStore.settings.slug")}</Label>
          <Input id="store-slug" name="slug" defaultValue={values.store_slug ?? ""} maxLength={60} autoCapitalize="none" />
          <p className="text-xs text-muted-foreground">{t("onlineStore.settings.slugHelp")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="store-color">{t("onlineStore.settings.color")}</Label>
          <Input
            id="store-color"
            name="color"
            type="color"
            defaultValue={values.store_color ?? DEFAULT_STORE_COLOR}
            className="h-10 w-20 p-1"
          />
        </div>
      </div>

      </fieldset>

      {path ? (
        <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3 text-sm">
          <span className="text-muted-foreground">
            {values.store_enabled ? t("onlineStore.settings.link") : t("onlineStore.settings.off")}
          </span>
          <code className="break-all">{path}</code>
          {values.store_enabled ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={path} target="_blank" rel="noopener">
                  {t("onlineStore.settings.open")}
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(`${window.location.origin}${path}`);
                  setCopied(true);
                }}
              >
                {copied ? t("onlineStore.settings.copied") : t("onlineStore.settings.copy")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <EditActions editing={mode.editing} pending={pending} saved={!!state?.ok} onEdit={mode.edit} onCancel={mode.cancel} />
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}
