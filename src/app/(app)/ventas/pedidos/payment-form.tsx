"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { registerCustomerPayment } from "@/actions/customer-payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYMENT_METHODS } from "@/lib/validation/sales";

export function PaymentForm({
  saleId,
  customerId,
  balance,
}: {
  saleId: string;
  customerId: string;
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations();

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={() => setOpen(true)}>
        {t("sales.orders.registerPayment")}
      </Button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 min-w-[200px]"
      action={async (formData) => {
        setPending(true);
        setError(null);
        const res = await registerCustomerPayment(null, formData);
        if (!res?.ok) {
          setError(res?.error || "common.errors.unknown");
          setPending(false);
        } else {
          setOpen(false);
        }
      }}
    >
      <input type="hidden" name="sale_id" value={saleId} />
      <input type="hidden" name="customer_id" value={customerId} />
      <Input
        name="amount"
        type="number"
        step="0.01"
        min="0.01"
        max={balance}
        placeholder={t("sales.orders.maxAmount", { amount: balance.toFixed(2) })}
        required
        className="h-8 text-xs"
      />
      <Select name="method" required defaultValue="cash">
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={t("sales.orders.methodPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {PAYMENT_METHODS.map((value) => (
            <SelectItem key={value} value={value} className="text-xs">
              {t(`sales.paymentMethod.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-1">
        <Button type="submit" size="sm" disabled={pending} className="h-7 text-xs flex-1">
          {pending ? "..." : t("sales.orders.collect")}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} className="h-7 text-xs flex-1" onClick={() => setOpen(false)}>
          {t("sales.orders.cancel")}
        </Button>
      </div>
      {error && <p className="text-[10px] text-destructive leading-tight">{t(error)}</p>}
    </form>
  );
}
