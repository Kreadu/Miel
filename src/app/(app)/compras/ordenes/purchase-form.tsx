"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { createPurchase, updatePurchase } from "@/actions/purchases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { purchaseNumber } from "@/lib/purchases/approval";
import { purchaseLine } from "@/lib/purchases/line";
import { type SplitLine, splitTotal, toPurchaseItems } from "@/lib/purchases/warehouse-split";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { splitProducts } from "./product-options";
import { SupplierPicker } from "./supplier-picker";

type Supplier = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  sku: string;
  cost: number | null;
  tax_rate: number | null;
  photo_url: string | null;
};

const PURCHASES_PATH = "/compras";

type Warehouse = { id: string; name: string; is_default: boolean };

/** S26-11: producto + costo + cantidad por bodega (una sola si la empresa tiene una bodega). */
type ItemDraft = SplitLine & { key: string };

function emptyItem(): ItemDraft {
  return { key: crypto.randomUUID(), product_id: "", qty: "1", unit_cost: "0", tax_rate: "0", byWarehouse: {} };
}

type EditingPurchase = {
  id: string;
  number: number;
  supplier_id: string;
  note: string;
  items: SplitLine[];
};

export function PurchaseForm({
  suppliers,
  products,
  warehouses,
  suggestedBySupplier,
  purchase,
  initialItems,
  canApprove = false,
  onSuccess,
}: {
  suppliers: Supplier[];
  products: Product[];
  warehouses: Warehouse[];
  suggestedBySupplier: Record<string, string[]>;
  purchase?: EditingPurchase;
  /** S19-27: alta con ítems ya cargados (desde Alertas stock mínimo). */
  initialItems?: SplitLine[];
  /** S26-02: "Crear y ordenar" solo para quien aprueba (la orden nace aprobada). */
  canApprove?: boolean;
  onSuccess?: () => void;
}) {
  const isEditing = purchase != null;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  // Al abrir "Editar" desde la lista (más abajo), llevar la vista al formulario.
  useEffect(() => {
    if (isEditing) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isEditing]);
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(isEditing ? updatePurchase : createPurchase, null);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) {
      onSuccess?.();
      if (isEditing) router.push(PURCHASES_PATH);
    }
  }

  const [items, setItems] = useState<ItemDraft[]>(() => {
    const start = purchase?.items ?? initialItems ?? [];
    return start.length > 0
      ? start.map((it) => ({ ...it, key: crypto.randomUUID() }))
      : [emptyItem()];
  });
  const [supplierId, setSupplierId] = useState(purchase?.supplier_id ?? "");
  const [showAll, setShowAll] = useState(false);

  const suggestedIds = suggestedBySupplier[supplierId] ?? [];
  const keepIds = items.map((it) => it.product_id).filter(Boolean);
  const { suggested, rest } = splitProducts(products, suggestedIds, { showAll, keepIds });

  function updateItem(key: string, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function onProductChange(key: string, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateItem(key, {
      product_id: productId,
      // S23-01: el costo del producto no lleva IVA (se recupera).
      unit_cost: product?.cost != null ? String(product.cost) : "0",
      tax_rate: product?.tax_rate != null ? String(product.tax_rate) : "0",
    });
  }

  const total = useMemo(() => {
    // Ayuda visual solo: la BD recalcula y es la fuente de verdad (create_purchase, S3-02).
    return items.reduce(
      (acc, it) =>
        acc +
        purchaseLine(splitTotal(it, warehouses), Number(it.unit_cost) || 0, Number(it.tax_rate) || 0).total,
      0,
    );
  }, [items, warehouses]);

  const multiWarehouse = warehouses.length > 1;
  const itemsPayload = JSON.stringify(toPurchaseItems(items, warehouses));

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex scroll-mt-4 flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      {isEditing ? (
        <h2 className="text-base font-semibold tracking-tight">
          {t("purchases.form.editing", { number: purchaseNumber(purchase.number) })}
        </h2>
      ) : null}
      <input type="hidden" name="items" value={itemsPayload} />
      {isEditing ? <input type="hidden" name="id" value={purchase.id} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SupplierPicker suppliers={suppliers} value={supplierId} onChange={setSupplierId} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="note">{t("purchases.form.note")}</Label>
          <Input id="note" name="note" maxLength={500} defaultValue={purchase?.note} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label>{t("purchases.form.items")}</Label>
          <div className="flex items-center gap-2">
            {suggestedIds.length > 0 ? (
              <Button type="button" variant="link" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? t("purchases.form.onlySuggested") : t("purchases.form.allCatalog")}
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => setItems((p) => [...p, emptyItem()])}>
              {t("purchases.form.addItem")}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {/* S19-37: foto · producto (código) · cantidad · costo antes de IVA · IVA · costo
              unitario con IVA (lo que se paga; el costo del producto es sin IVA, S23-01) · costo total. */}
          <div className="hidden gap-2 text-xs text-muted-foreground sm:grid sm:grid-cols-[2.5rem_minmax(0,2fr)_repeat(5,minmax(0,1fr))_4.5rem]">
            <span />
            <span>{t("purchases.product")}</span>
            <span className="text-right">{t("purchases.qty")}</span>
            <span className="text-right">{t("purchases.form.costBeforeTax")}</span>
            <span className="text-right">{t("purchases.taxPercent")}</span>
            <span className="text-right">{t("purchases.form.unitWithTax")}</span>
            <span className="text-right">{t("purchases.form.lineTotal")}</span>
            <span />
          </div>
          {items.map((item) => {
            const product = products.find((p) => p.id === item.product_id);
            const qtyTotal = splitTotal(item, warehouses);
            const line = purchaseLine(
              qtyTotal,
              Number(item.unit_cost) || 0,
              Number(item.tax_rate) || 0,
            );
            return (
              <div
                key={item.key}
                className="grid grid-cols-2 items-center gap-2 border-b border-border pb-3 last:border-0 sm:grid-cols-[2.5rem_minmax(0,2fr)_repeat(5,minmax(0,1fr))_4.5rem] sm:border-0 sm:pb-0"
              >
                <div className="relative size-10 overflow-hidden rounded-md bg-muted">
                  {product?.photo_url ? (
                    <Image src={product.photo_url} alt={product.name} fill unoptimized className="object-cover" />
                  ) : null}
                </div>
                <Select value={item.product_id} onValueChange={(v) => onProductChange(item.key, v)}>
                  <SelectTrigger className="w-full min-w-0" aria-label={t("purchases.product")}>
                    <SelectValue placeholder={t("purchases.form.productPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {suggested.length > 0 ? (
                      <SelectGroup>
                        <SelectLabel>{t("purchases.form.suggested")}</SelectLabel>
                        {suggested.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.sku} — {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null}
                    {rest.length > 0 ? (
                      <>
                        {suggested.length > 0 ? <SelectSeparator /> : null}
                        <SelectGroup>
                          {suggested.length > 0 ? <SelectLabel>{t("purchases.form.allProducts")}</SelectLabel> : null}
                          {rest.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.sku} — {p.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </>
                    ) : null}
                  </SelectContent>
                </Select>
                {multiWarehouse ? (
                  <p className="text-right text-sm font-medium tabular-nums" aria-label={t("purchases.qty")}>
                    {qtyTotal}
                  </p>
                ) : (
                  <Input
                    type="number"
                    min={0}
                    step="0.001"
                    aria-label={t("purchases.qty")}
                    className="text-right"
                    value={item.qty}
                    onChange={(e) => updateItem(item.key, { qty: e.target.value })}
                  />
                )}
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  aria-label={t("purchases.form.costBeforeTax")}
                  className="text-right"
                  value={item.unit_cost}
                  onChange={(e) => updateItem(item.key, { unit_cost: e.target.value })}
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  aria-label={t("purchases.taxPercent")}
                  className="text-right"
                  value={item.tax_rate}
                  onChange={(e) => updateItem(item.key, { tax_rate: e.target.value })}
                />
                <p className="text-right text-sm tabular-nums" aria-label={t("purchases.form.unitWithTax")}>
                  {formatMoney(line.unitWithTax)}
                </p>
                <p className="text-right text-sm font-medium tabular-nums" aria-label={t("purchases.form.lineTotal")}>
                  {formatMoney(line.total)}
                </p>
                <div className="flex justify-end">
                  {items.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setItems((prev) => prev.filter((it) => it.key !== item.key))}
                    >
                      {t("purchases.form.remove")}
                    </Button>
                  ) : null}
                </div>
                {multiWarehouse ? (
                  <div className="col-span-full flex flex-wrap items-end gap-3 sm:pl-12">
                    <span className="w-full text-xs text-muted-foreground sm:w-auto sm:self-center">
                      {t("purchases.form.qtyByWarehouse")}
                    </span>
                    {warehouses.map((w) => (
                      <label key={w.id} className="flex w-28 flex-col gap-1 text-xs text-muted-foreground">
                        <span className="truncate" title={w.name}>
                          {w.name}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step="0.001"
                          className="text-right"
                          value={item.byWarehouse[w.id] ?? ""}
                          placeholder="0"
                          onChange={(e) =>
                            updateItem(item.key, { byWarehouse: { ...item.byWarehouse, [w.id]: e.target.value } })
                          }
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="text-right text-base font-semibold tabular-nums">
          {t("purchases.form.purchaseTotal", { amount: formatMoney(total) })}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <Button type="submit" disabled={pending}>
              {pending ? t("purchases.form.saving") : t("purchases.form.saveChanges")}
            </Button>
            <Button asChild variant="outline" disabled={pending}>
              <Link href={PURCHASES_PATH}>{t("purchases.cancel")}</Link>
            </Button>
          </>
        ) : (
          <>
            {/* S26-09: el aprobador crea y envía en un paso; quien no aprueba pide aprobación. */}
            {canApprove ? (
              <>
                <Button type="submit" name="status" value="ordered" disabled={pending}>
                  {pending ? t("purchases.form.saving") : t("purchases.form.createAndOrder")}
                </Button>
                <Button type="submit" name="status" value="draft" variant="outline" disabled={pending}>
                  {t("purchases.form.saveDraft")}
                </Button>
              </>
            ) : (
              <Button type="submit" name="status" value="draft" disabled={pending}>
                {pending ? t("purchases.form.saving") : t("purchases.form.requestApproval")}
              </Button>
            )}
          </>
        )}
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
          {state.error === "purchases.errors.displayNameRequired" ? (
            <>
              {" "}
              <Link href="/equipo/trabajadores" className="underline">
                {t("purchases.goToProfile")}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}
