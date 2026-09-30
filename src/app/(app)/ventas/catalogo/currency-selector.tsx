"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { getExchangeRate } from "@/actions/exchange-rate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

export function CurrencySelector({
  baseCurrency,
  onChange,
}: {
  baseCurrency: string;
  onChange: (currency: string, rate: number) => void;
}) {
  const [selected, setSelected] = useState(baseCurrency);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useTranslations();

  function handleChange(code: string) {
    setSelected(code);
    setError(null);
    startTransition(async () => {
      const result = await getExchangeRate(baseCurrency, code);
      if (result.ok) {
        onChange(code, result.rate);
      } else {
        setError(result.error);
        onChange(baseCurrency, 1);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("catalog.viewPricesIn")}</span>
        <Select value={selected} onValueChange={handleChange}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} — {t(`catalog.currencies.${c.code}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pending ? <span className="text-xs text-muted-foreground">{t("catalog.converting")}</span> : null}
      </div>
      {error ? <p className="text-xs text-destructive">{t(error)}</p> : null}
      {selected !== baseCurrency && !error ? (
        <p className="text-xs text-muted-foreground">
          {t("catalog.approxConversion")}
        </p>
      ) : null}
    </div>
  );
}
