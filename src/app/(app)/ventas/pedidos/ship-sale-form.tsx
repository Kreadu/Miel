"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { markSaleShipped } from "@/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ShipSaleForm({ saleId }: { saleId: string }) {
  const [shipping, setShipping] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations();

  if (shipping) {
    return (
      <form
        className="flex flex-col gap-2 min-w-[200px]"
        action={async (formData) => {
          setPending(true);
          setError(null);
          const address = formData.get("shipping_address") as string;
          const res = await markSaleShipped(saleId, address);
          if (!res?.ok) {
            setError(res?.error || "common.errors.unknown");
            setPending(false);
          } else {
            setShipping(false);
          }
        }}
      >
        <Input 
          name="shipping_address" 
          placeholder={t("sales.orders.addressPlaceholder")}
          required 
          className="h-8 text-xs" 
        />
        <div className="flex gap-1">
          <Button type="submit" size="sm" disabled={pending} className="h-7 text-xs flex-1">
            {pending ? "..." : t("sales.orders.save")}
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            disabled={pending} 
            className="h-7 text-xs flex-1" 
            onClick={() => setShipping(false)}
          >
            {t("sales.orders.cancel")}
          </Button>
        </div>
        {error && <p className="text-[10px] text-destructive leading-tight">{t(error)}</p>}
      </form>
    );
  }

  return (
    <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={() => setShipping(true)}>
      {t("sales.orders.ship")}
    </Button>
  );
}
