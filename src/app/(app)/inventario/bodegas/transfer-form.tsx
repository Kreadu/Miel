"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { transferStock } from "@/actions/warehouses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type TransferProduct = { id: string; name: string; sku: string; qty: number };

/**
 * S19-39: trasladar stock de esta bodega a otra (p. ej. antes de darla de baja). Se elige el
 * destino, las cantidades (o "Trasladar todo") y se confirma; sale y entra al mismo costo.
 */
export function TransferForm({
  fromId,
  fromName,
  destinations,
  products,
}: {
  fromId: string;
  fromName: string;
  destinations: { id: string; name: string }[];
  products: TransferProduct[];
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [state, action, pending] = useActionState(transferStock, null);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) {
      setOpen(false);
      setQty({});
      setTo("");
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} disabled={products.length === 0}>
        {t("warehouses.transfer.open")}
      </Button>
    );
  }

  const items = products
    .map((p) => ({ product_id: p.id, qty: Number(qty[p.id]) || 0 }))
    .filter((i) => i.qty > 0);
  const tooMany = products.some((p) => (Number(qty[p.id]) || 0) > p.qty);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const name = destinations.find((d) => d.id === to)?.name ?? "";
        if (!confirm(t("warehouses.transfer.confirm", { from: fromName, to: name }))) e.preventDefault();
      }}
      className="flex w-full flex-col gap-3 rounded-md border border-border bg-muted/30 p-3"
    >
      <p className="text-sm font-medium">{t("warehouses.transfer.title", { name: fromName })}</p>
      <input type="hidden" name="from" value={fromId} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <div className="flex flex-col gap-2 sm:max-w-xs">
        <Label>{t("warehouses.transfer.to")}</Label>
        <Select value={to} onValueChange={setTo}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("warehouses.transfer.chooseTo")} />
          </SelectTrigger>
          <SelectContent>
            {destinations.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{t("warehouses.transfer.products")}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setQty(Object.fromEntries(products.map((p) => [p.id, String(p.qty)])))}
          >
            {t("warehouses.transfer.all")}
          </Button>
        </div>
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-card">
          {products.map((p) => (
            <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto_5rem] items-center gap-2 px-3 py-2 text-sm">
              <span className="truncate">
                {p.name} <span className="text-xs text-muted-foreground">· {p.sku}</span>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {t("warehouses.transfer.have", { qty: p.qty })}
              </span>
              <Input
                type="number"
                min={0}
                max={p.qty}
                step="1"
                aria-label={p.name}
                className="h-8 text-right"
                value={qty[p.id] ?? ""}
                onChange={(e) => setQty((prev) => ({ ...prev, [p.id]: e.target.value }))}
              />
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`transfer-note-${fromId}`}>{t("warehouses.transfer.note")}</Label>
        <Input id={`transfer-note-${fromId}`} name="note" maxLength={200} />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending || !to || items.length === 0 || tooMany}>
          {pending ? t("warehouses.transfer.moving") : t("warehouses.transfer.submit")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          {t("warehouses.cancel")}
        </Button>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}
