"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { registerCustomerPayment } from "@/actions/customer-payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/validation/sales";

/**
 * S18-07: cobro pensado para personas con poca práctica — la forma de pago elegida en el carrito
 * va en el mismo botón ("Cobrar $X en Efectivo", un clic = saldo completo). Si no hay o se quiere
 * cambiar: 4 botones grandes y el monto ya puesto en el saldo (se puede bajar para un abono).
 */
export function PaymentForm({
  saleId,
  customerId,
  balance,
  defaultMethod,
}: {
  saleId: string;
  customerId: string;
  balance: number;
  defaultMethod: string | null;
}) {
  const t = useTranslations();
  const [choosing, setChoosing] = useState(false);
  const [amount, setAmount] = useState(String(balance));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const known = defaultMethod && (PAYMENT_METHODS as readonly string[]).includes(defaultMethod) ? defaultMethod : null;

  function pay(method: string, value: string) {
    const formData = new FormData();
    formData.set("sale_id", saleId);
    formData.set("customer_id", customerId);
    formData.set("amount", value);
    formData.set("method", method);
    setError(null);
    startTransition(async () => {
      const res = await registerCustomerPayment(null, formData);
      if (!res?.ok) setError(res?.error ?? "common.errors.unknown");
    });
  }

  const errorLine = error ? <p className="text-xs leading-tight text-destructive">{t(error)}</p> : null;

  if (!choosing) {
    return (
      <div className="flex w-full flex-col items-end gap-1">
        <Button
          size="sm"
          className="w-full"
          disabled={pending}
          onClick={() => (known ? pay(known, String(balance)) : setChoosing(true))}
        >
          {pending
            ? t("sales.orders.charging")
            : known
              ? t("sales.orders.chargeWith", {
                  amount: formatMoney(balance),
                  method: t(`sales.paymentMethod.${known}`).toLowerCase(),
                })
              : t("sales.orders.charge", { amount: formatMoney(balance) })}
        </Button>
        {known ? (
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-4"
            onClick={() => setChoosing(true)}
          >
            {t("sales.orders.changeMethod")}
          </button>
        ) : null}
        {errorLine}
      </div>
    );
  }

  return (
    <div className="flex min-w-[220px] flex-col gap-2">
      <p className="text-sm font-medium">{t("sales.orders.howPays")}</p>
      <div className="grid grid-cols-2 gap-2">
        {PAYMENT_METHODS.map((m) => (
          <Button key={m} type="button" variant={m === known ? "default" : "outline"} disabled={pending} onClick={() => pay(m, amount)}>
            {t(`sales.paymentMethod.${m}`)}
          </Button>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`amount-${saleId}`} className="text-xs">
          {t("sales.orders.amount")}
        </Label>
        <Input
          id={`amount-${saleId}`}
          type="number"
          min="0.01"
          max={balance}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-8 text-right"
        />
      </div>
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setChoosing(false)}>
        {t("sales.orders.cancel")}
      </Button>
      {errorLine}
    </div>
  );
}
