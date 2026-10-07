"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { saveStorePayments } from "@/actions/online-store";
import { EditActions, useEditMode } from "@/components/edit-mode";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Values = {
  store_nequi: string | null;
  store_daviplata: string | null;
  store_bank_info: string | null;
  store_payment_qr_url: string | null;
  store_cash_on_delivery: boolean;
  store_pay_in_store: boolean;
};

/** S27-03: formas de pago que ofrece la tienda en línea (lo que la empresa no llena, no se ofrece). */
export function StorePaymentsForm({ values }: { values: Values }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(saveStorePayments, null);
  const mode = useEditMode(state);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{t("onlineStore.payments.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("onlineStore.payments.subtitle")}</p>
      </div>

      <fieldset key={mode.formKey} disabled={!mode.editing} className="contents">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pay-nequi">{t("onlineStore.payments.nequi")}</Label>
          <Input id="pay-nequi" name="nequi" type="tel" inputMode="tel" maxLength={20} defaultValue={values.store_nequi ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pay-daviplata">{t("onlineStore.payments.daviplata")}</Label>
          <Input id="pay-daviplata" name="daviplata" type="tel" inputMode="tel" maxLength={20} defaultValue={values.store_daviplata ?? ""} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="pay-bank">{t("onlineStore.payments.bank")}</Label>
          <textarea
            id="pay-bank"
            name="bank_info"
            rows={2}
            maxLength={300}
            defaultValue={values.store_bank_info ?? ""}
            placeholder={t("onlineStore.payments.bankPlaceholder")}
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="pay-qr">{t("onlineStore.payments.qr")}</Label>
        {values.store_payment_qr_url ? (
          <div className="flex items-center gap-4">
            <div className="relative size-24 overflow-hidden rounded-md border border-border bg-white">
              <Image src={values.store_payment_qr_url} alt={t("onlineStore.payments.qr")} fill unoptimized className="object-contain" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="remove_qr" className="h-4 w-4 accent-primary" />
              {t("onlineStore.payments.removeQr")}
            </label>
          </div>
        ) : null}
        <Input id="pay-qr" name="qr" type="file" accept="image/jpeg,image/png,image/webp" />
        <p className="text-xs text-muted-foreground">{t("onlineStore.payments.qrHelp")}</p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="cash_on_delivery" defaultChecked={values.store_cash_on_delivery} className="h-4 w-4 accent-primary" />
          {t("onlineStore.order.payments.cash_on_delivery")}
        </label>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="pay_in_store" defaultChecked={values.store_pay_in_store} className="h-4 w-4 accent-primary" />
          {t("onlineStore.order.payments.in_store")}
        </label>
      </div>

      </fieldset>
      <EditActions editing={mode.editing} pending={pending} saved={!!state?.ok} onEdit={mode.edit} onCancel={mode.cancel} />
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}
