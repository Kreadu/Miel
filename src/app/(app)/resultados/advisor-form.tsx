"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { askAdvisor } from "@/actions/advisor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** S22-03: pregunta al asesor con IA sobre el rango que se está viendo. */
export function AdvisorForm({ from, to, configured }: { from: string; to: string; configured: boolean }) {
  const [state, action, pending] = useActionState(askAdvisor, null);
  const t = useTranslations();

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="desde" value={from} />
      <input type="hidden" name="hasta" value={to} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="question">{t("results.advisor.question")}</Label>
        <textarea
          id="question"
          name="question"
          required
          minLength={3}
          maxLength={1000}
          rows={3}
          disabled={!configured || pending}
          placeholder={t("results.advisor.placeholder")}
          className="w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!configured || pending}>
          {pending ? t("results.advisor.analyzing") : t("results.advisor.ask")}
        </Button>
        {pending && (
          <p role="status" className="text-xs text-muted-foreground">
            {t("results.advisor.waiting")}
          </p>
        )}
        {!configured && (
          <p className="text-xs text-muted-foreground">{t("results.advisor.notConfigured")}</p>
        )}
      </div>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      )}
    </form>
  );
}
