"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markupFromPrice, priceFromMarkup } from "@/lib/pricing";

/**
 * S19-34: Costo · % de venta · Precio de venta en una fila. El precio sale del costo + %; si se
 * escribe el precio a mano, el % se recalcula. Solo se guardan costo y precio (el % se deriva).
 */
export function PriceFields({ cost, price }: { cost: number; price: number | undefined }) {
  const t = useTranslations("catalog");
  const [costValue, setCostValue] = useState(String(cost));
  const [markup, setMarkup] = useState(() => {
    const m = markupFromPrice(cost, price ?? 0);
    return m === null ? "" : String(m);
  });
  const [priceValue, setPriceValue] = useState(price === undefined ? "" : String(price));

  function onCost(value: string) {
    setCostValue(value);
    if (markup !== "") setPriceValue(String(priceFromMarkup(Number(value) || 0, Number(markup) || 0)));
  }

  function onMarkup(value: string) {
    setMarkup(value);
    setPriceValue(String(priceFromMarkup(Number(costValue) || 0, Number(value) || 0)));
  }

  function onPrice(value: string) {
    setPriceValue(value);
    const m = markupFromPrice(Number(costValue) || 0, Number(value) || 0);
    setMarkup(m === null ? "" : String(m));
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="cost">{t("cost")}</Label>
        <Input
          id="cost"
          name="cost"
          type="number"
          min={0}
          step="0.01"
          required
          value={costValue}
          onChange={(e) => onCost(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="markup_percent">{t("markupPercent")}</Label>
        <Input
          id="markup_percent"
          type="number"
          step="0.01"
          value={markup}
          onChange={(e) => onMarkup(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="price">{t("price")}</Label>
        <Input
          id="price"
          name="price"
          type="number"
          min={0}
          step="0.01"
          required
          value={priceValue}
          onChange={(e) => onPrice(e.target.value)}
        />
      </div>
    </div>
  );
}
