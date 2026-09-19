"use client";

import { useActionState, useMemo, useState } from "react";

import { createSale } from "@/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COUNTER_LABEL = "__counter__";

type Customer = { id: string; name: string };
type Product = { id: string; name: string; sku: string; price: number | null; tax_rate: number | null };

type ItemDraft = {
  key: string;
  product_id: string;
  qty: string;
  unit_price: string;
  tax_rate: string;
  discount_pct: string;
};

function emptyItem(): ItemDraft {
  return {
    key: crypto.randomUUID(),
    product_id: "",
    qty: "1",
    unit_price: "0",
    tax_rate: "0",
    discount_pct: "0",
  };
}

// El % es solo captura de UI (más cómodo que calcular el monto a mano); la BD siempre
// almacena el monto en sale_items.discount, precio de lista intacto (ADR-017).
function lineDiscountAmount(item: ItemDraft): number {
  const qty = Number(item.qty) || 0;
  const price = Number(item.unit_price) || 0;
  const pct = Number(item.discount_pct) || 0;
  return (qty * price * pct) / 100;
}

export function SaleForm({
  customers,
  products,
  onSuccess,
}: {
  customers: Customer[];
  products: Product[];
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(createSale, null);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) onSuccess?.();
  }

  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);

  function updateItem(key: string, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function onProductChange(key: string, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateItem(key, {
      product_id: productId,
      unit_price: product?.price != null ? String(product.price) : "0",
      tax_rate: product?.tax_rate != null ? String(product.tax_rate) : "0",
    });
  }

  const total = useMemo(() => {
    // Ayuda visual solo: la BD recalcula y es la fuente de verdad (create_sale, S5-02/S5-08).
    return items.reduce((acc, it) => {
      const qty = Number(it.qty) || 0;
      const price = Number(it.unit_price) || 0;
      const tax = Number(it.tax_rate) || 0;
      const line = qty * price - lineDiscountAmount(it);
      return acc + line * (1 + tax / 100);
    }, 0);
  }, [items]);

  const itemsPayload = JSON.stringify(
    items
      .filter((it) => it.product_id)
      .map((it) => ({
        product_id: it.product_id,
        qty: it.qty,
        unit_price: it.unit_price,
        tax_rate: it.tax_rate,
        discount: lineDiscountAmount(it),
      })),
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <input type="hidden" name="items" value={itemsPayload} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="customer_id">Cliente</Label>
          <Select name="customer_id" defaultValue={COUNTER_LABEL}>
            <SelectTrigger id="customer_id" className="w-full">
              <SelectValue placeholder="Mostrador / sin cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={COUNTER_LABEL}>Mostrador / sin cliente</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="note">Nota (opcional)</Label>
          <Input id="note" name="note" maxLength={500} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Ítems</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((p) => [...p, emptyItem()])}>
            Agregar ítem
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.key} className="grid grid-cols-1 gap-2 sm:grid-cols-6 sm:items-end">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label className="text-xs">Producto</Label>
                <Select value={item.product_id} onValueChange={(v) => onProductChange(item.key, v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.sku} — {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Cantidad</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  value={item.qty}
                  onChange={(e) => updateItem(item.key, { qty: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Precio unit.</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => updateItem(item.key, { unit_price: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Desc. %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={item.discount_pct}
                  onChange={(e) => updateItem(item.key, { discount_pct: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs">IVA %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={item.tax_rate}
                    onChange={(e) => updateItem(item.key, { tax_rate: e.target.value })}
                  />
                </div>
                {items.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setItems((prev) => prev.filter((it) => it.key !== item.key))}
                  >
                    Quitar
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <p className="text-right text-sm text-muted-foreground">
          Total estimado: {formatMoney(total)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Crear borrador"}
        </Button>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
