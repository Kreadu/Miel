"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, null);

  const t = useTranslations();

  return (
    <form action={action} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("common.password")}</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("auth.login.submitting") : t("auth.login.submit")}
      </Button>
    </form>
  );
}
