"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";

import { refreshCartProductData } from "@/actions/catalog";
import { checkoutCounterSale, createSale } from "@/actions/sales";
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
import { saleLine } from "@/lib/sales/line";
import { DOCUMENT_TYPES, PAYMENT_METHODS } from "@/lib/validation/sales";

import { useCatalogCart } from "../use-catalog-cart";
import {
  AllocationPicker,
  type AllocationState,
  type AllocationWarehouse,
  EMPTY_ALLOCATION,
  resolveAllocations,
  type StockMap,
} from "./allocation-picker";
import { DeliverySection, type Rate } from "./delivery-section";

const NO_CUSTOMER = "__counter__";

/**
 * S19-06/S19-07: el carrito armado desde /ventas/catalogo se confirma acá, en la misma página
 * de Pedidos — no en una ruta aparte. Si no hay carrito (nadie vino del catálogo), no renderiza
 * nada (S19-36: la venta se arma solo desde el catálogo).
 */
export function CatalogPedidoCart({
  tenantId,
  customers,
  rates,
  warehouses,
  defaultWarehouseId,
  stock,
  canManage,
}: {
  tenantId: string;
  customers: { id: string; name: string }[];
  /** S19-35: transportes de Vender → Envíos. */
  rates: Rate[];
  /** S18-06: bodegas para "Cobrar y entregar"; viene marcada la del trabajador o la principal. */
  warehouses: AllocationWarehouse[];
  defaultWarehouseId: string | null;
  /** S18-10: stock por producto y bodega, para ver cuánto hay y completar desde otra. */
  stock: StockMap;
  /** S18-10: dueño/admin pueden habilitar con un clic que una bodega preste stock. */
  canManage: boolean;
}) {
  const { lines, updateQty, updateLineData, removeItem, clear } = useCatalogCart(tenantId);
  const [state, formAction, pending] = useActionState(createSale, null);
  // S18-06: venta de mostrador en un paso (crea, boleta, cobro total y entrega).
  const [checkoutState, checkoutAction, checkoutPending] = useActionState(checkoutCounterSale, null);
  const [paymentMethod, setPaymentMethod] = useState("");
  // S18-10: la bodega de la venta es la propia (trabajador o principal); el reparto lo arma el usuario.
  const warehouseId = defaultWarehouseId ?? "";
  const [alloc, setAlloc] = useState<AllocationState>(EMPTY_ALLOCATION);
  const t = useTranslations();

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
  const [seenCheckout, setSeenCheckout] = useState(checkoutState);
  // S18-10: tras cobrar y entregar, pantalla limpia y un aviso con la boleta.
  const [done, setDone] = useState<number | null>(null);
  if (lines.length > 0 && done !== null) setDone(null);
  if (checkoutState !== seenCheckout) {
    setSeenCheckout(checkoutState);
    if (checkoutState?.ok) {
      clear();
      setPaymentMethod("");
      setAlloc(EMPTY_ALLOCATION);
      setDone(checkoutState.receiptNumber ?? 0);
    }
  }
  // El error que se muestra es el del último botón usado.
  const [lastAction, setLastAction] = useState<"order" | "checkout">("order");
  const shownState = lastAction === "checkout" ? checkoutState : state;
  const busy = pending || checkoutPending;
  // Carrito vacío (confirmado, vaciado o sin ítems): la sección de entrega se desmonta, así que
  // su resumen también se limpia (ajuste de estado en render, sin efecto).
  if (lines.length === 0 && delivery.method !== null) setDelivery({ method: null, cost: 0 });

  // Misma cuenta que create_sale (S23-01: redondeo por línea): total = Σ línea + Σ IVA.
  const { subtotal, tax, total } = useMemo(() => {
    return lines.reduce(
      (acc, l) => {
        const { net, tax: lineTax } = saleLine(l.qty, l.price, l.discountPercent, l.taxRate);
        return {
          subtotal: acc.subtotal + net,
          tax: acc.tax + lineTax,
          total: acc.total + net + lineTax,
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

  const allocationItems = lines.map((l) => ({ productId: l.productId, name: l.name, qty: l.qty }));
  const { covered, allocations } = resolveAllocations(allocationItems, alloc);

  const itemsPayload = JSON.stringify(
    // S23-01: precio, IVA y descuento los pone create_sale desde el producto.
    lines.map((l) => ({ product_id: l.productId, qty: l.qty })),
  );

  if (lines.length === 0) {
    return done !== null ? (
      <p role="status" className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
        {done ? t("sales.cart.doneWithReceipt", { number: done }) : t("sales.cart.done")}
      </p>
    ) : null;
  }

  return (
    // S18-06: se envía a mano (no con `action`): React 19 resetea un <form action> tras cada
    // envío y los Select de Radix vuelven a su valor inicial — un error borraba forma de pago,
    // cliente y comprobante ya elegidos. Así, tras un error todo queda como estaba.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const checkout = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "checkout";
        setLastAction(checkout ? "checkout" : "order");
        startTransition(() => (checkout ? checkoutAction(formData) : formAction(formData)));
      }}
      className="flex flex-col gap-4 rounded-lg border border-primary/30 bg-card p-4 shadow-xs"
    >
      <input type="hidden" name="items" value={itemsPayload} />

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{t("sales.cart.title")}</p>
        <p className="text-xs text-muted-foreground">
          {t("sales.cart.help")}
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
                {t("sales.cart.remove")}
              </Button>
            </div>
          </div>
        ))}
        <div className="flex flex-col items-end gap-0.5 pt-2 text-sm">
          <p className="text-muted-foreground">{t("sales.cart.subtotal", { amount: formatMoney(subtotal) })}</p>
          <p className="text-muted-foreground">
            {t("sales.cart.tax", { country: DEFAULT_TAX_COUNTRY_LABEL })}
            {commonTaxRate !== null ? ` (${commonTaxRate}%)` : ""}: {formatMoney(tax)}
          </p>
          <p className="font-semibold">{t("sales.cart.total", { amount: formatMoney(total) })}</p>
        </div>
      </div>

      <DeliverySection rates={rates} weightKg={weightKg} onChange={setDelivery} />

      {delivery.method ? (
        <div className="flex flex-col items-end gap-0.5 border-t border-border pt-3 text-sm">
          <p className="text-muted-foreground">{t("sales.cart.shipping", { amount: formatMoney(delivery.cost) })}</p>
          <p className="text-base font-semibold">{t("sales.cart.totalWithShipping", { amount: formatMoney(total + delivery.cost) })}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="payment_method">{t("sales.cart.paymentMethod")}</Label>
          <Select name="payment_method" value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger id="payment_method" className="w-full">
              <SelectValue placeholder={t("sales.cart.noChoice")} />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`sales.paymentMethod.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="customer_id">{t("sales.cart.customer")}</Label>
          <Select name="customer_id" defaultValue={NO_CUSTOMER}>
            <SelectTrigger id="customer_id" className="w-full">
              <SelectValue placeholder={t("sales.cart.counter")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CUSTOMER}>{t("sales.cart.counter")}</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {delivery.method === "pickup" ? (
          <>
            <input type="hidden" name="warehouse_id" value={warehouseId} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="document_type">{t("sales.cart.document")}</Label>
              <Select name="document_type" defaultValue="boleta">
                <SelectTrigger id="document_type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {t(`sales.cart.documentTypes.${d}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("sales.cart.invoiceHint")}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium">{t("sales.allocation.title")}</p>
              <input type="hidden" name="allocations" value={covered ? JSON.stringify(allocations) : ""} />
              <AllocationPicker
                items={allocationItems}
                warehouses={warehouses}
                homeId={warehouseId || null}
                stock={stock}
                value={alloc}
                onChange={setAlloc}
                canManage={canManage}
              />
            </div>
          </>
        ) : null}
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="note">{t("sales.cart.note")}</Label>
          <Input id="note" name="note" maxLength={500} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {delivery.method === "pickup" ? (
          <Button
            type="submit"
            value="checkout"
            disabled={busy || !paymentMethod || !covered}
          >
            {checkoutPending ? t("sales.cart.charging") : t("sales.cart.checkout")}
          </Button>
        ) : null}
        <Button
          type="submit"
          variant={delivery.method === "pickup" ? "outline" : "default"}
          value="order"
          disabled={busy || !delivery.method}
        >
          {pending ? t("sales.cart.creating") : t("sales.cart.saveAsOrder")}
        </Button>
        <Button type="button" variant="ghost" onClick={clear}>
          {t("sales.cart.clear")}
        </Button>
        <Button asChild variant="ghost" type="button">
          <Link href="/ventas/catalogo">{t("sales.cart.keepBrowsing")}</Link>
        </Button>
      </div>
      {delivery.method === "pickup" && !paymentMethod ? (
        <p className="text-xs text-muted-foreground">{t("sales.cart.paymentRequiredHint")}</p>
      ) : null}
      {shownState && !shownState.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {t(shownState.error)}
        </p>
      ) : null}
    </form>
  );
}
