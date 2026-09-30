"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { requestPasswordReset } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  const t = useTranslations();

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("common.email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state && !state.ok ? state.email : undefined}
          required
        />
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t(state.message)}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("auth.forgot.submitting") : t("auth.forgot.submit")}
      </Button>
    </form>
  );
}
