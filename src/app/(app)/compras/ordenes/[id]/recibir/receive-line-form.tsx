"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { receivePurchaseLine } from "@/actions/purchase-receipts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { receiptPricePreview } from "@/lib/pricing";

/**
 * S28-01/S28-02: cantidad (y para dueño/admin costo, IVA y precio de venta) de una línea. Al
 * guardar entra al inventario; el precio propuesto mantiene el mismo % sobre el costo.
 */
export function ReceiveLineForm({
  purchaseId,
  invoiceId,
  itemId,
  pending,
  isAdmin,
  orderCost,
  orderTax,
  product,
}: {
  purchaseId: string;
  invoiceId: string;
  itemId: string;
  pending: number;
  isAdmin: boolean;
  orderCost: number;
  orderTax: number;
  product: { stock: number; cost: number; price: number } | null;
}) {
  const t = useTranslations();
  const [state, action, saving] = useActionState(receivePurchaseLine, null);
  const [qty, setQty] = useState(String(pending));
  const [cost, setCost] = useState(String(orderCost));
  const [salePrice, setSalePrice] = useState("");

  const preview =
    product && Number(qty) > 0
      ? receiptPricePreview({ ...product, qty: Number(qty), unitCost: Number(cost) || 0 })
      : null;
  const priceChanges = !!product && !!preview && preview.price !== product.price;
  const noCost = !!product && !(product.cost > 0) && product.price > 0;
  const id = (name: string) => `${itemId}-${name}`;

  return (
    <form action={action} className="flex flex-col gap-3 border-t border-border pt-3">
      <input type="hidden" name="purchase_id" value={purchaseId} />
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <input type="hidden" name="purchase_item_id" value={itemId} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("qty")}>{t("purchases.receipt.qty")}</Label>
          <Input
            id={id("qty")}
            name="qty"
            type="number"
            inputMode="decimal"
            min={0}
            max={pending}
            step="any"
            required
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>
        {isAdmin ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={id("cost")}>{t("purchases.receipt.unitCost")}</Label>
              <Input
                id={id("cost")}
                name="unit_cost"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                required
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={id("tax")}>{t("purchases.receipt.taxRate")}</Label>
              <Input id={id("tax")} name="tax_rate" type="number" inputMode="decimal" min={0} max={100} step="0.01" required defaultValue={orderTax} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={id("price")}>{t("purchases.receipt.salePrice")}</Label>
              <Input
                id={id("price")}
                name="sale_price"
                type="number"
                inputMode="decimal"
                min={0}
                step="1"
                placeholder={preview ? String(preview.price) : ""}
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </div>
          </>
        ) : null}
      </div>
      {isAdmin && product && priceChanges && !salePrice ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          {t("purchases.receipt.pricePreview", {
            from: `$${formatMoney(product.price)}`,
            to: `$${formatMoney(preview!.price)}`,
          })}
        </p>
      ) : null}
      {noCost && !salePrice ? <p className="text-xs text-muted-foreground">{t("purchases.receipt.checkPrice")}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {state && !state.ok ? (
          <p role="alert" className="text-sm text-destructive sm:mr-auto">
            {t(state.error)}
          </p>
        ) : null}
        <Button type="submit" variant="outline" disabled={saving} className="w-full sm:w-auto">
          {saving ? t("purchases.receipt.saving") : t("purchases.receipt.saveLine")}
        </Button>
      </div>
    </form>
  );
}
