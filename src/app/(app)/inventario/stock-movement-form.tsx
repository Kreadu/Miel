"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { registerManualMovement } from "@/actions/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Product = { id: string; name: string; sku: string; unit: string };
type Warehouse = { id: string; name: string };

/**
 * Registrar un movimiento de stock sobre un producto que ya existe (S13-01). Único componente
 * para los dos sitios donde aplica: `/inventario` (elige producto y bodega) y el kardex de un
 * producto (`productId`/`warehouseId` ya conocidos, quedan como campos ocultos).
 * El alta de un producto nuevo con su stock inicial vive en `productos/product-form.tsx`.
 */
export function StockMovementForm({
  products,
  warehouses,
  productId,
  warehouseId,
}: {
  products?: Product[];
  warehouses?: Warehouse[];
  productId?: string;
  warehouseId?: string;
}) {
  const [state, formAction, pending] = useActionState(registerManualMovement, null);
  const [open, setOpen] = useState(!!productId);
  const [seenState, setSeenState] = useState(state);
  const [kind, setKind] = useState<"in" | "out" | "adjust">("in");
  const [qty, setQty] = useState("10");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const qtyNum = Number(qty);
  const showCost = kind === "in" || (kind === "adjust" && !(qtyNum < 0));
  const qtyLabel =
    kind === "in" ? "Cantidad (Entrada)" : kind === "out" ? "Cantidad (Salida)" : "Cantidad (Ajuste +/-)";

  // React 19 resetea el <form> (incluida la selección visual del Select de Radix) tras CADA
  // envío, éxito o error. En error queremos que el usuario recupere justo lo que tenía para
  // reintentar (p. ej. stock_insufficient en una salida/ajuste, S13-03); el snapshot se toma en
  // onSubmit (antes del reset) y se reaplica en un efecto (después del reset, que ocurre en el
  // commit disparado por el cambio de `state`).
  const beforeSubmit = useRef<{
    kind: "in" | "out" | "adjust";
    qty: string;
    selectedProductId: string;
    selectedWarehouseId: string;
  } | null>(null);

  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) {
      setKind("in");
      setQty("10");
      setSelectedProductId("");
      setSelectedWarehouseId("");
      if (!productId) setOpen(false);
    }
  }

  useEffect(() => {
    if (state && !state.ok && beforeSubmit.current) {
      const snap = beforeSubmit.current;
      setKind(snap.kind);
      setQty(snap.qty);
      setSelectedProductId(snap.selectedProductId);
      setSelectedWarehouseId(snap.selectedWarehouseId);
    }
  }, [state]);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        + Registrar movimiento de stock
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={() => {
        beforeSubmit.current = { kind, qty, selectedProductId, selectedWarehouseId };
      }}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Registrar movimiento de stock</h3>
        {!productId && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            X
          </Button>
        )}
      </div>
      {!productId && (
        <p className="text-xs text-muted-foreground -mt-2">
          Para un producto que ya existe. Si aún no lo creaste, hazlo en Productos.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {productId ? (
          <input type="hidden" name="product_id" value={productId} />
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="product_id">Producto</Label>
            {/* Sin `name` en el Select: su input nativo oculto se pierde en el reset que React 19
                hace del <form> tras cada envío (éxito o error). El hidden input de abajo, ligado
                a value={selectedProductId}, es inmune a ese reset (S13-03) y es lo que viaja. */}
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger id="product_id">
                <SelectValue placeholder="Selecciona un producto" />
              </SelectTrigger>
              <SelectContent>
                {products?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.sku} - {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="product_id" value={selectedProductId} />
          </div>
        )}

        {warehouseId ? (
          <input type="hidden" name="warehouse_id" value={warehouseId} />
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="warehouse_id">Bodega</Label>
            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
              <SelectTrigger id="warehouse_id">
                <SelectValue placeholder="Selecciona una bodega" />
              </SelectTrigger>
              <SelectContent>
                {warehouses?.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="warehouse_id" value={selectedWarehouseId} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="kind">Tipo de movimiento</Label>
          <Select
            value={kind}
            onValueChange={(value) => {
              const next = value as "in" | "out" | "adjust";
              setKind(next);
              if (next !== "adjust" && qtyNum < 0) setQty("10");
            }}
          >
            <SelectTrigger id="kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in">Entrada</SelectItem>
              <SelectItem value="out">Salida</SelectItem>
              <SelectItem value="adjust">Ajuste</SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" name="kind" value={kind} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="qty">{qtyLabel}</Label>
          <Input
            id="qty"
            name="qty"
            type="number"
            min={kind === "adjust" ? undefined : "1"}
            step="1"
            required
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          {kind === "adjust" && (
            <p className="text-xs text-muted-foreground">Usa un número negativo para descontar.</p>
          )}
        </div>

        {showCost && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="unit_cost">Costo unitario</Label>
            <Input id="unit_cost" name="unit_cost" type="number" min="0" step="0.01" required defaultValue={100} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar movimiento"}
        </Button>
        {state && !state.ok ? <span className="text-sm text-destructive">{state.error}</span> : null}
      </div>
    </form>
  );
}
