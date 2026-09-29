"use client";

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
        <span className="text-xs text-muted-foreground">Ver precios en</span>
        <Select value={selected} onValueChange={handleChange}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} — {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pending ? <span className="text-xs text-muted-foreground">Convirtiendo…</span> : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {selected !== baseCurrency && !error ? (
        <p className="text-xs text-muted-foreground">
          Conversión aproximada (tasa de mercado), no es un precio de cobro.
        </p>
      ) : null}
    </div>
  );
}
