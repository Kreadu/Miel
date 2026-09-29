"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import {
  DELIVERY_LABEL,
  DELIVERY_METHODS,
  type DeliveryMethod,
  type ShippingRate,
  shippingCost,
} from "@/lib/shipping";

export type Rate = ShippingRate & { id: string; name: string };

/**
 * S19-35: forma de entrega del pedido. Devuelve el costo del envío al padre para mostrar el
 * total con envío. Es solo vista previa: create_sale recalcula el costo del transporte en la BD.
 */
export function DeliverySection({
  rates,
  weightKg,
  onChange,
}: {
  rates: Rate[];
  weightKg: number;
  onChange: (value: { method: DeliveryMethod | null; cost: number }) => void;
}) {
  const [method, setMethod] = useState<DeliveryMethod | null>(null);
  const [agreed, setAgreed] = useState("");
  const [km, setKm] = useState("");
  const [rateId, setRateId] = useState("");

  const kmValue = Number(km) || 0;
  const rateCost = (r: Rate) => shippingCost(r, weightKg, kmValue);

  function report(next: { method?: DeliveryMethod; agreed?: string; km?: string; rateId?: string }) {
    const m = next.method ?? method;
    const a = next.agreed ?? agreed;
    const k = Number(next.km ?? km) || 0;
    const r = rates.find((x) => x.id === (next.rateId ?? rateId));
    const cost =
      m === "agreed" ? Number(a) || 0 : m === "carrier" && r ? shippingCost(r, weightKg, k) : 0;
    onChange({ method: m, cost });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Forma de entrega</p>
      <input type="hidden" name="delivery_method" value={method ?? ""} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DELIVERY_METHODS.map((m) => (
          <Button
            key={m}
            type="button"
            variant={method === m ? "default" : "outline"}
            className="justify-start"
            onClick={() => {
              setMethod(m);
              report({ method: m });
            }}
          >
            {DELIVERY_LABEL[m]}
          </Button>
        ))}
      </div>

      {method === "agreed" ? (
        <div className="flex flex-col gap-2 sm:w-64">
          <Label htmlFor="shipping_cost">Valor acordado del envío</Label>
          <Input
            id="shipping_cost"
            name="shipping_cost"
            type="number"
            min={0}
            step="0.01"
            required
            value={agreed}
            onChange={(e) => {
              setAgreed(e.target.value);
              report({ agreed: e.target.value });
            }}
          />
        </div>
      ) : null}

      {method === "carrier" ? (
        rates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay transportes configurados. Agrégalos en Vender → Envíos.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="shipping_km">Distancia (km)</Label>
                <Input
                  id="shipping_km"
                  name="shipping_km"
                  type="number"
                  min={0}
                  step="0.1"
                  required
                  value={km}
                  onChange={(e) => {
                    setKm(e.target.value);
                    report({ km: e.target.value });
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Peso del pedido</span>
                <p className="flex h-9 items-center text-sm tabular-nums text-muted-foreground">
                  {weightKg.toLocaleString("es-CO")} kg
                </p>
              </div>
            </div>
            <input type="hidden" name="shipping_rate_id" value={rateId} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {rates.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRateId(r.id);
                    report({ rateId: r.id });
                  }}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    rateId === r.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className="font-medium">{r.name}</span>
                  <span className="tabular-nums">{formatMoney(rateCost(r))}</span>
                </button>
              ))}
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
