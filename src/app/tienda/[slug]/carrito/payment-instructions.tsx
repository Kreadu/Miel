"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { uploadPaymentProof } from "@/actions/store-payment";
import { formatMoney } from "@/lib/currency";
import { paymentInstructions, type StorePaymentMethod, type StorePayments } from "@/lib/store/payments";

/** S27-03: a dónde pagar (valor exacto y referencia) y subida del comprobante. */
export function PaymentInstructions({
  method,
  payments,
  code,
  total,
  currency,
  token,
}: {
  method: StorePaymentMethod;
  payments: StorePayments;
  code: string;
  total: number;
  currency: string;
  token: string | null;
}) {
  const t = useTranslations("onlineStore");
  const [state, action, pending] = useActionState(uploadPaymentProof, null);
  const how = paymentInstructions(method, payments);
  const amount = formatMoney(total, currency);

  if (how.kind === "offline") {
    return <p className="text-sm text-muted-foreground">{t(`proof.offline.${method}`, { amount })}</p>;
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left">
      <p className="text-sm">{t(`proof.howTo.${method}`, { amount })}</p>
      <p className="whitespace-pre-line break-words rounded-md bg-muted px-3 py-2 text-base font-semibold tabular-nums">{how.value}</p>
      <p className="text-sm text-muted-foreground">{t("proof.reference", { code })}</p>
      {payments.qr ? (
        <div className="relative mx-auto aspect-square w-full max-w-60 overflow-hidden rounded-md border border-border bg-white">
          <Image src={payments.qr} alt={t("proof.qrAlt")} fill unoptimized className="object-contain" />
        </div>
      ) : null}

      {token ? (
        state?.ok ? (
          <p role="status" className="text-sm font-medium">{t("proof.sent")}</p>
        ) : (
          <form action={action} className="flex flex-col gap-2">
            <input type="hidden" name="token" value={token} />
            <label htmlFor="proof-file" className="text-sm font-medium">{t("proof.upload")}</label>
            <input
              id="proof-file"
              name="proof"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="text-sm file:mr-3 file:h-10 file:rounded-md file:border file:border-border file:bg-background file:px-3"
            />
            <p className="text-xs text-muted-foreground">{t("proof.help")}</p>
            {state && !state.ok ? (
              <p role="alert" className="text-sm text-destructive">{t(state.error.replace(/^onlineStore\./, ""))}</p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="h-11 rounded-md bg-(--store) px-4 text-sm font-semibold text-(--store-fg) disabled:opacity-50"
            >
              {pending ? t("proof.sending") : t("proof.send")}
            </button>
          </form>
        )
      ) : null}
    </div>
  );
}
