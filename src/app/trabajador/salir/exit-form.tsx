"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { exitStoreMode } from "@/actions/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** S21-03: salir del modo tienda pide la contraseña de la cuenta de la tienda. */
export function ExitForm() {
  const [state, action, pending] = useActionState(exitStoreMode, null);
  const t = useTranslations();
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("store.accountPassword")}</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? t("store.verifying") : t("store.exit")}
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}
