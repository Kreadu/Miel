"use client";

import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type RateValues = {
  name: string;
  base_price: number;
  price_per_kg: number;
  price_per_km: number;
};

const FIELDS = ["base_price", "price_per_kg", "price_per_km"] as const;

/** S19-35: nombre + tarifa (base + por kg + por km) de un transporte. */
export function RateFields({ idPrefix, values }: { idPrefix: string; values?: RateValues }) {
  const t = useTranslations("shipping");
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-name`}>{t("transport")}</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          required
          maxLength={60}
          placeholder={t("transportPlaceholder")}
          defaultValue={values?.name}
        />
      </div>
      {FIELDS.map((f) => (
        <div key={f} className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-${f}`}>{t(f)}</Label>
          <Input
            id={`${idPrefix}-${f}`}
            name={f}
            type="number"
            min={0}
            step="0.01"
            defaultValue={values?.[f] ?? 0}
          />
        </div>
      ))}
    </div>
  );
}
