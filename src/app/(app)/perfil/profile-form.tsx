"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { setMyDisplayName } from "@/actions/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** S26-01: "Tu nombre" — queda en las órdenes de compra que pidas, apruebes o envíes (E26). */
export function ProfileForm({ displayName }: { displayName: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(setMyDisplayName, null);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-col gap-2">
        <Label htmlFor="display_name">{t("profile.name")}</Label>
        <Input id="display_name" name="display_name" required maxLength={80} defaultValue={displayName} />
        <p className="text-xs text-muted-foreground">{t("profile.nameHelp")}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t("profile.saving") : t("profile.save")}
        </Button>
        {state?.ok ? <span className="text-sm text-muted-foreground">{t("profile.saved")}</span> : null}
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}
