"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { createTenant } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createTenant, null);

  const t = useTranslations("onboarding");
  const tr = useTranslations();

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" autoComplete="organization" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="nit">{t("nit")}</Label>
        <Input id="nit" name="nit" />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("howSells")}</Label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="sellsPhysical"
            defaultChecked
            className="h-4 w-4 accent-primary"
          />
          {t("physical")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sellsVirtual" className="h-4 w-4 accent-primary" />
          {t("virtual")}
        </label>
        <p className="text-xs text-muted-foreground">{t("pickOne")}</p>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {tr(state.error)}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
