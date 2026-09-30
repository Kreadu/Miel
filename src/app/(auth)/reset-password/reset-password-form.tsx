"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { updatePassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);

  const t = useTranslations();

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("auth.reset.newPassword")}</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("auth.reset.submitting") : t("auth.reset.submit")}
      </Button>
    </form>
  );
}
