"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { registerPosSale } from "@/actions/pos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { QuickCustomerDialog } from "./quick-customer-dialog";

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

function lineDiscountAmount(item: ItemDraft): number {
  const qty = Number(item.qty) || 0;
  const price = Number(item.unit_price) || 0;
  const pct = Number(item.discount_pct) || 0;
  return (qty * price * pct) / 100;
}

export function PosTerminal({
  customers,
  products,
  warehouses,
}: {
  customers: { id: string; name: string }[];
  products: { id: string; name: string; price: number; tax_rate: number; sku: string }[];
  warehouses: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(registerPosSale, null);
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [customerList, setCustomerList] = useState(customers);
  const [customerId, setCustomerId] = useState("__counter__");

  const onProductChange = (key: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setItems((prev) =>
      prev.map((it) =>
        it.key === key
          ? {
              ...it,
              product_id: product.id,
              unit_price: String(product.price),
              tax_rate: String(product.tax_rate),
            }
          : it,
      ),
    );
  };

  const updateItem = (key: string, updates: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...updates } : it)));
  };

  const removeItem = (key: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : [emptyItem()]));
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const total = useMemo(() => {
    return items.reduce((acc, it) => {
      const qty = Number(it.qty) || 0;
      const price = Number(it.unit_price) || 0;
      const tax = Number(it.tax_rate) || 0;
      const line = qty * price - lineDiscountAmount(it);
      return acc + line * (1 + tax / 100);
    }, 0);
  }, [items]);

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-medium">Venta Registrada</h3>
          <p className="text-sm text-muted-foreground mt-1">El cobro ha sido procesado exitosamente.</p>
        </div>
        <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
          Nueva Venta
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state?.error && (
        <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive font-medium">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="warehouse_id">Bodega Origen</Label>
          <Select name="warehouse_id" defaultValue={warehouses[0]?.id}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una bodega" />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="customer_id">Cliente (Opcional)</Label>
            <QuickCustomerDialog
              onCreated={(customer) => {
                setCustomerList((prev) => [customer, ...prev]);
                setCustomerId(customer.id);
              }}
            />
          </div>
          {/* Radix Select no admite value="" (lo reserva para "sin selección"): el sentinel
              __counter__ representa "Mostrador"; la Server Action lo normaliza a ausente.
              No controlado (defaultValue, no value/onValueChange): un Select controlado no
              registra el label de un ítem agregado después del mount sin que el usuario abra
              el desplegable — dispara onValueChange("") al perder la opción coincidente en el
              <select> nativo espejo. `key={customerId}` fuerza el remount con el defaultValue
              correcto cada vez que se crea un cliente (mismo patrón ya probado en "Bodega
              Origen" un poco más arriba); la selección manual del usuario sigue funcionando
              nativamente sin handler propio. */}
          <Select key={customerId} name="customer_id" defaultValue={customerId}>
            <SelectTrigger id="customer_id" className="w-full">
              <SelectValue placeholder="Mostrador (Sin cliente)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__counter__">Mostrador (Sin cliente)</SelectItem>
              {customerList.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium">Productos</h3>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            Agregar Ítem
          </Button>
        </div>
        
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <div key={item.key} className="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:items-end">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label className="text-xs">Producto</Label>
                <Select value={item.product_id} onValueChange={(v) => onProductChange(item.key, v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.sku} - {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Cant.</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={item.qty}
                  onChange={(e) => updateItem(item.key, { qty: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Precio</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => updateItem(item.key, { unit_price: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Desc. %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={item.discount_pct}
                  onChange={(e) => updateItem(item.key, { discount_pct: e.target.value })}
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label className="text-xs">IVA %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={item.tax_rate}
                    onChange={(e) => updateItem(item.key, { tax_rate: e.target.value })}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(item.key)}>
                  <span className="sr-only">Remover</span>
                  &times;
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="payment_method">Método de Pago</Label>
            <Select name="payment_method" defaultValue="cash">
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex flex-col gap-2">
            <Label htmlFor="note">Notas (Opcional)</Label>
            <Input name="note" placeholder="Detalles de la venta..." />
          </div>
        </div>

        <div className="flex flex-col justify-end gap-4 rounded-lg bg-primary/5 p-6 text-right">
          <div className="text-sm font-medium text-muted-foreground">Total a Cobrar</div>
          <div className="text-4xl font-bold tabular-nums tracking-tight">
            ${formatMoney(total)}
          </div>
          <Button type="submit" disabled={isPending} className="mt-2 h-12 w-full text-lg">
            {isPending ? "Procesando..." : "Cobrar"}
          </Button>
        </div>
      </div>

      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          items.map((it) => ({
            product_id: it.product_id,
            qty: it.qty,
            unit_price: it.unit_price,
            tax_rate: it.tax_rate,
            discount: lineDiscountAmount(it),
          })),
        )}
      />
      <input type="hidden" name="total" value={total.toFixed(2)} />
    </form>
  );
}
