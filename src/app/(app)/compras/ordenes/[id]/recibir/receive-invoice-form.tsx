"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { receivePurchaseInvoice } from "@/actions/purchase-receipts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { receiptPricePreview } from "@/lib/pricing";
import { linesTotals } from "@/lib/purchases/line";

export type ReceiveItem = {
  id: string;
  name: string;
  photoUrl: string | null;
  warehouseId: string | null;
  ordered: number;
  received: number;
  unitCost: number;
  taxRate: number;
  /** Solo dueño/admin: para proponer el precio de venta con el mismo % (S28-02). */
  product: { stock: number; cost: number; price: number } | null;
};

type Split = { key: string; warehouse_id: string; qty: string };
type Draft = { splits: Split[]; cost: string; tax: string; salePrice: string };

const newKey = () => crypto.randomUUID();

/**
 * S28-04: la factura del proveedor en un solo formulario. Arriba los datos de la factura; en el
 * medio lo que llegó de cada producto (repartido por bodega, con su costo e IVA); abajo los
 * totales que se van sumando y la comparación con lo que esperaba la orden.
 */
export function ReceiveInvoiceForm({
  purchaseId,
  isAdmin,
  warehouses,
  items,
  expected,
}: {
  purchaseId: string;
  isAdmin: boolean;
  warehouses: { id: string; name: string }[];
  items: ReceiveItem[];
  expected: { subtotal: number; tax: number; total: number } | null;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(receivePurchaseInvoice, null);
  const fallbackWarehouse = warehouses[0]?.id ?? "";
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      items.map((it) => [
        it.id,
        {
          splits: [
            { key: newKey(), warehouse_id: it.warehouseId ?? fallbackWarehouse, qty: String(it.ordered - it.received) },
          ],
          cost: String(it.unitCost),
          tax: String(it.taxRate),
          salePrice: "",
        },
      ]),
    ),
  );

  const update = (id: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const updateSplit = (id: string, key: string, patch: Partial<Split>) =>
    update(id, { splits: drafts[id].splits.map((s) => (s.key === key ? { ...s, ...patch } : s)) });

  const lines = items.flatMap((it) => {
    const d = drafts[it.id];
    return d.splits.map((s) => ({
      purchase_item_id: it.id,
      warehouse_id: s.warehouse_id,
      qty: s.qty,
      unit_cost: isAdmin ? d.cost : "",
      tax_rate: isAdmin ? d.tax : "",
      sale_price: isAdmin ? d.salePrice : "",
    }));
  });
  const totals = linesTotals(
    items.flatMap((it) =>
      drafts[it.id].splits.map((s) => ({
        qty: Number(s.qty) || 0,
        unit_cost: Number(drafts[it.id].cost) || 0,
        tax_rate: Number(drafts[it.id].tax) || 0,
      })),
    ),
  );

  return (
    <form action={action} className="flex flex-col gap-6 rounded-lg border border-border bg-card p-4">
      <input type="hidden" name="purchase_id" value={purchaseId} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{t("purchases.receipt.invoiceTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("purchases.receipt.invoiceHelp")}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rcv-number">{t("purchases.receipt.number")}</Label>
            <Input id="rcv-number" name="number" required maxLength={60} placeholder="FE-123" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rcv-issued">{t("purchases.receipt.issued")}</Label>
            <Input id="rcv-issued" name="issued_on" type="date" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rcv-due">{t("purchases.receipt.due")}</Label>
            <Input id="rcv-due" name="due_on" type="date" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rcv-file">{t("purchases.receipt.file")}</Label>
            <Input
              id="rcv-file"
              name="file"
              type="file"
              accept="application/pdf,.pdf,.xml,text/xml,application/xml,.zip,application/zip,image/jpeg,image/png,image/webp"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="rcv-cufe">{t("purchases.receipt.cufe")}</Label>
            <Input id="rcv-cufe" name="cufe" maxLength={200} />
            <p className="text-xs text-muted-foreground">{t("purchases.receipt.cufeHelp")}</p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">{t("purchases.receipt.arrived")}</h2>
        <ul className="flex flex-col gap-3">
          {items.map((it) => {
            const d = drafts[it.id];
            const pendingQty = it.ordered - it.received;
            const arrived = d.splits.reduce((sum, s) => sum + (Number(s.qty) || 0), 0);
            const preview =
              isAdmin && it.product && arrived > 0
                ? receiptPricePreview({ ...it.product, qty: arrived, unitCost: Number(d.cost) || 0 })
                : null;
            return (
              <li key={it.id} className="flex flex-col gap-3 rounded-md border border-border p-3">
                <div className="flex items-center gap-3">
                  {it.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.photoUrl} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="size-10 shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {t("purchases.receipt.progress", { ordered: it.ordered, received: it.received, pending: pendingQty })}
                    </p>
                  </div>
                  <p
                    className={`text-sm tabular-nums ${arrived > pendingQty ? "font-semibold text-destructive" : "text-muted-foreground"}`}
                  >
                    {t("purchases.receipt.arrivedOf", { arrived, pending: pendingQty })}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {d.splits.map((s, i) => (
                    <div key={s.key} className="flex flex-wrap items-end gap-2">
                      <label className="flex w-24 flex-col gap-1 text-xs text-muted-foreground">
                        {t("purchases.receipt.qty")}
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          className="text-right"
                          value={s.qty}
                          onChange={(e) => updateSplit(it.id, s.key, { qty: e.target.value })}
                        />
                      </label>
                      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
                        {t("purchases.receipt.warehouse")}
                        <Select value={s.warehouse_id} onValueChange={(v) => updateSplit(it.id, s.key, { warehouse_id: v })}>
                          <SelectTrigger className="w-full min-w-0">
                            <SelectValue placeholder={t("purchases.warehousePlaceholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouses.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      {i > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => update(it.id, { splits: d.splits.filter((x) => x.key !== s.key) })}
                        >
                          {t("purchases.form.remove")}
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {warehouses.length > 1 ? (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="self-start px-0"
                      onClick={() =>
                        update(it.id, {
                          splits: [
                            ...d.splits,
                            {
                              key: newKey(),
                              warehouse_id: warehouses.find((w) => !d.splits.some((x) => x.warehouse_id === w.id))?.id ?? fallbackWarehouse,
                              qty: "0",
                            },
                          ],
                        })
                      }
                    >
                      {t("purchases.receipt.addSplit")}
                    </Button>
                  ) : null}
                </div>

                {isAdmin ? (
                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {t("purchases.receipt.unitCost")}
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        className="text-right"
                        value={d.cost}
                        onChange={(e) => update(it.id, { cost: e.target.value })}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {t("purchases.receipt.taxRate")}
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        step="0.01"
                        className="text-right"
                        value={d.tax}
                        onChange={(e) => update(it.id, { tax: e.target.value })}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {t("purchases.receipt.salePrice")}
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="1"
                        className="text-right"
                        placeholder={preview ? String(preview.price) : ""}
                        value={d.salePrice}
                        onChange={(e) => update(it.id, { salePrice: e.target.value })}
                      />
                    </label>
                    {preview && it.product && preview.price !== it.product.price && !d.salePrice ? (
                      <p className="col-span-3 text-xs text-muted-foreground tabular-nums">
                        {t("purchases.receipt.pricePreview", {
                          from: `$${formatMoney(it.product.price)}`,
                          to: `$${formatMoney(preview.price)}`,
                        })}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {isAdmin ? (
        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <dt>{t("purchases.receipt.subtotal")}</dt>
              <dd className="tabular-nums">${formatMoney(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t("purchases.receipt.tax")}</dt>
              <dd className="tabular-nums">${formatMoney(totals.tax)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>{t("purchases.receipt.total")}</dt>
              <dd className="tabular-nums">${formatMoney(totals.total)}</dd>
            </div>
          </dl>
          {expected ? (
            <p
              className={`text-sm tabular-nums ${Math.abs(expected.total - totals.total) >= 1 ? "font-medium text-destructive" : "text-muted-foreground"}`}
            >
              {t("purchases.receipt.compare", {
                expected: `$${formatMoney(expected.total)}`,
                arrived: `$${formatMoney(totals.total)}`,
                pending: `$${formatMoney(Math.max(expected.total - totals.total, 0))}`,
              })}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {state && !state.ok ? (
          <p role="alert" className="text-sm text-destructive sm:mr-auto">
            {t(state.error)}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? t("purchases.receipt.saving") : t("purchases.receipt.saveInvoice")}
        </Button>
      </div>
    </form>
  );
}
