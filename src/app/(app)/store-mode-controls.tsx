"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { activateStoreMode, releaseWorker } from "@/actions/store";
import { Button } from "@/components/ui/button";

/**
 * S21-03: controles del modo tienda en el menú. En modo tienda: quién está y "Cambiar
 * trabajador". Con una cuenta operativa fuera del modo tienda: el botón para activarlo.
 */
export function StoreModeControls({
  storeMode,
  workerName,
  canActivate,
}: {
  storeMode: boolean;
  workerName: string | null;
  canActivate: boolean;
}) {
  const [state, activate, pending] = useActionState(() => activateStoreMode(), null);
  const t = useTranslations();

  if (storeMode) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-sidebar-border p-2 text-sm">
        <span className="text-xs text-muted-foreground">{t("store.mode")}</span>
        <span className="font-medium">{workerName ?? t("store.noWorker")}</span>
        <form action={releaseWorker}>
          <Button type="submit" size="sm" variant="outline" className="w-full">
            {t("store.changeWorker")}
          </Button>
        </form>
        <Link href="/trabajador/salir" className="text-center text-xs text-muted-foreground underline underline-offset-4">
          {t("store.exit")}
        </Link>
      </div>
    );
  }

  if (!canActivate) return null;

  return (
    <form action={activate} className="flex flex-col gap-1">
      <Button type="submit" size="sm" variant="outline" className="w-full" disabled={pending}>
        {t("store.activate")}
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="text-xs text-destructive">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}
