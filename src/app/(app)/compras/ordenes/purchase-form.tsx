"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState } from "react";

import { createPurchase, updatePurchase } from "@/actions/purchases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
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

type Supplier = { id: string; name: string };
type Product = { id: string; name: string; sku: string; cost: number | null; tax_rate: number | null };

type ItemDraft = {
  key: string;
  product_id: string;
  qty: string;
  unit_cost: string;
  tax_rate: string;
};

function emptyItem(): ItemDraft {
  return { key: crypto.randomUUID(), product_id: "", qty: "1", unit_cost: "0", tax_rate: "0" };
}

type EditingPurchase = {
  id: string;
  supplier_id: string;
  note: string;
  items: Omit<ItemDraft, "key">[];
};

export function PurchaseForm({
  suppliers,
  products,
  suggestedBySupplier,
  purchase,
  onSuccess,
}: {
  suppliers: Supplier[];
  products: Product[];
  suggestedBySupplier: Record<string, string[]>;
  purchase?: EditingPurchase;
  onSuccess?: () => void;
}) {
  const isEditing = purchase != null;
  const router = useRouter();
  const [state, formAction, pending] = useActionState(isEditing ? updatePurchase : createPurchase, null);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) {
      onSuccess?.();
      if (isEditing) router.push("/compras/ordenes");
    }
  }

  const [items, setItems] = useState<ItemDraft[]>(
    purchase ? purchase.items.map((it) => ({ ...it, key: crypto.randomUUID() })) : [emptyItem()],
  );
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
      unit_cost: product?.cost != null ? String(product.cost) : "0",
      tax_rate: product?.tax_rate != null ? String(product.tax_rate) : "0",
    });
  }

  const total = useMemo(() => {
    // Ayuda visual solo: la BD recalcula y es la fuente de verdad (create_purchase, S3-02).
    return items.reduce((acc, it) => {
      const qty = Number(it.qty) || 0;
      const cost = Number(it.unit_cost) || 0;
      const tax = Number(it.tax_rate) || 0;
      return acc + qty * cost * (1 + tax / 100);
    }, 0);
  }, [items]);

  const itemsPayload = JSON.stringify(
    items
      .filter((it) => it.product_id)
      .map((it) => ({
        product_id: it.product_id,
        qty: it.qty,
        unit_cost: it.unit_cost,
        tax_rate: it.tax_rate,
      })),
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <input type="hidden" name="items" value={itemsPayload} />
      {isEditing ? <input type="hidden" name="id" value={purchase.id} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="supplier_id">Proveedor</Label>
          <Select name="supplier_id" required value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger id="supplier_id" className="w-full">
              <SelectValue placeholder="Selecciona un proveedor" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="note">Nota (opcional)</Label>
          <Input id="note" name="note" maxLength={500} defaultValue={purchase?.note} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Ítems</Label>
          <div className="flex items-center gap-2">
            {suggestedIds.length > 0 ? (
              <Button type="button" variant="link" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Ver solo sugeridos" : "Ver todo el catálogo"}
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => setItems((p) => [...p, emptyItem()])}>
              Agregar ítem
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.key} className="grid grid-cols-1 gap-2 sm:grid-cols-5 sm:items-end">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label className="text-xs">Producto</Label>
                <Select value={item.product_id} onValueChange={(v) => onProductChange(item.key, v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {suggested.length > 0 ? (
                      <SelectGroup>
                        <SelectLabel>Sugeridos para este proveedor</SelectLabel>
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
                          {suggested.length > 0 ? <SelectLabel>Todo el catálogo</SelectLabel> : null}
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
                <Label className="text-xs">Costo unit.</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.unit_cost}
                  onChange={(e) => updateItem(item.key, { unit_cost: e.target.value })}
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
        {isEditing ? (
          <>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar cambios"}
            </Button>
            <Button asChild variant="outline" disabled={pending}>
              <Link href="/compras/ordenes">Cancelar</Link>
            </Button>
          </>
        ) : (
          <>
            <Button type="submit" name="status" value="draft" disabled={pending}>
              {pending ? "Guardando…" : "Guardar como borrador"}
            </Button>
            <Button type="submit" name="status" value="ordered" variant="secondary" disabled={pending}>
              {pending ? "Guardando…" : "Crear y ordenar"}
            </Button>
          </>
        )}
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
