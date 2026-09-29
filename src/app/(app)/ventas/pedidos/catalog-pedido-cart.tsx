"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { refreshCartProductData } from "@/actions/catalog";
import { createSale } from "@/actions/sales";
import { DEFAULT_TAX_COUNTRY_LABEL } from "@/lib/validation/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/format";

import { useCatalogCart } from "../use-catalog-cart";
import { DeliverySection, type Rate } from "./delivery-section";

const NO_CUSTOMER = "__counter__";

const PAYMENT_METHOD_LABEL = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  other: "Otro",
} as const;

/**
 * S19-06/S19-07: el carrito armado desde /ventas/catalogo se confirma acá, en la misma página
 * de Pedidos — no en una ruta aparte. Si no hay carrito (nadie vino del catálogo), no renderiza
 * nada (S19-36: la venta se arma solo desde el catálogo).
 */
export function CatalogPedidoCart({
  tenantId,
  customers,
  rates,
}: {
  tenantId: string;
  customers: { id: string; name: string }[];
  /** S19-35: transportes de Vender → Envíos. */
  rates: Rate[];
}) {
  const { lines, updateQty, updateLineData, removeItem, clear } = useCatalogCart(tenantId);
  const [state, formAction, pending] = useActionState(createSale, null);

  // S19-11: reconcilia precio/descuento/IVA del carrito contra la BD una vez al entrar (no en
  // cada render — `refreshedRef` evita que la propia actualización de `lines` retrigger esto).
  const refreshedRef = useRef(false);
  useEffect(() => {
    if (refreshedRef.current || lines.length === 0) return;
    refreshedRef.current = true;
    refreshCartProductData(lines.map((l) => l.productId)).then((fresh) => {
      for (const p of fresh) {
        updateLineData(p.id, {
          name: p.name,
          price: p.price,
          discountPercent: p.discount_percent,
          taxRate: p.tax_rate,
          weightKg: p.weight_kg,
        });
      }
    });
  }, [lines, updateLineData]);

  // Ajuste de estado durante el render (mismo patrón usado en toda la sesión): al confirmar,
  // vacía el carrito — la lista de pedidos de abajo se refresca sola (revalidatePath de createSale).
  // S19-35: entrega elegida y su costo (vista previa; create_sale lo recalcula).
  const [delivery, setDelivery] = useState<{ method: string | null; cost: number }>({
    method: null,
    cost: 0,
  });
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) clear();
  }
  // Carrito vacío (confirmado, vaciado o sin ítems): la sección de entrega se desmonta, así que
  // su resumen también se limpia (ajuste de estado en render, sin efecto).
  if (lines.length === 0 && delivery.method !== null) setDelivery({ method: null, cost: 0 });

  // Mismo cálculo que create_sale en la BD (S5-08/S19-08): línea = qty·precio − descuento;
  // subtotal = Σ línea; iva = Σ (línea · IVA%); total = subtotal + iva. Verificado que coincide
  // exactamente con la RPC — lo que faltaba era mostrar el desglose, no corregir la cuenta.
  const { subtotal, tax, total } = useMemo(() => {
    return lines.reduce(
      (acc, l) => {
        const line = l.qty * l.price * (1 - l.discountPercent / 100);
        const lineTax = line * (l.taxRate / 100);
        return {
          subtotal: acc.subtotal + line,
          tax: acc.tax + lineTax,
          total: acc.total + line + lineTax,
        };
      },
      { subtotal: 0, tax: 0, total: 0 },
    );
  }, [lines]);

  const weightKg = lines.reduce((sum, l) => sum + l.qty * (l.weightKg ?? 0), 0);

  // Solo se muestra el % si todas las líneas comparten la misma tasa — evita un "(19%)" engañoso
  // cuando un producto puntual tiene otra tasa de IVA.
  const commonTaxRate =
    lines.length > 0 && lines.every((l) => l.taxRate === lines[0].taxRate) ? lines[0].taxRate : null;

  const itemsPayload = JSON.stringify(
    lines.map((l) => ({
      product_id: l.productId,
      qty: l.qty,
      unit_price: l.price,
      tax_rate: l.taxRate,
      discount: (l.qty * l.price * l.discountPercent) / 100,
    })),
  );

  if (lines.length === 0) return null;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-primary/30 bg-card p-4 shadow-xs"
    >
      <input type="hidden" name="items" value={itemsPayload} />

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Pedido armado desde el catálogo</p>
        <p className="text-xs text-muted-foreground">
          Ajustá cantidades, elegí la forma de entrega, la forma de pago y el cliente, y confirmá.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {lines.map((l) => (
          <div
            key={l.productId}
            className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-0"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{l.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatMoney(l.price)} × {l.qty}
                {l.discountPercent > 0 ? ` · -${l.discountPercent}%` : ""}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm tabular-nums">
                {formatMoney(l.qty * l.price * (1 - l.discountPercent / 100))}
              </span>
              <Input
                type="number"
                min={1}
                step="1"
                value={l.qty}
                onChange={(e) => updateQty(l.productId, Number(e.target.value) || 0)}
                className="h-8 w-20"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeItem(l.productId)}
              >
                Quitar
              </Button>
            </div>
          </div>
        ))}
        <div className="flex flex-col items-end gap-0.5 pt-2 text-sm">
          <p className="text-muted-foreground">Subtotal: {formatMoney(subtotal)}</p>
          <p className="text-muted-foreground">
            IVA {DEFAULT_TAX_COUNTRY_LABEL}
            {commonTaxRate !== null ? ` (${commonTaxRate}%)` : ""}: {formatMoney(tax)}
          </p>
          <p className="font-semibold">Total a pagar: {formatMoney(total)}</p>
        </div>
      </div>

      <DeliverySection rates={rates} weightKg={weightKg} onChange={setDelivery} />

      {delivery.method ? (
        <div className="flex flex-col items-end gap-0.5 border-t border-border pt-3 text-sm">
          <p className="text-muted-foreground">Envío: {formatMoney(delivery.cost)}</p>
          <p className="text-base font-semibold">Total con envío: {formatMoney(total + delivery.cost)}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="payment_method">Forma de pago (opcional)</Label>
          <Select name="payment_method">
            <SelectTrigger id="payment_method" className="w-full">
              <SelectValue placeholder="Sin elegir" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="customer_id">Cliente</Label>
          <Select name="customer_id" defaultValue={NO_CUSTOMER}>
            <SelectTrigger id="customer_id" className="w-full">
              <SelectValue placeholder="Mostrador / sin cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CUSTOMER}>Mostrador / sin cliente</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="note">Nota (opcional)</Label>
          <Input id="note" name="note" maxLength={500} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || !delivery.method}>
          {pending ? "Creando…" : "Confirmar pedido"}
        </Button>
        <Button type="button" variant="ghost" onClick={clear}>
          Vaciar carrito
        </Button>
        <Button asChild variant="ghost" type="button">
          <Link href="/ventas/catalogo">Seguir viendo el catálogo</Link>
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
