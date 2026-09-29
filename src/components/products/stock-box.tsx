"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WarehouseStock } from "@/lib/stock";

import type { Warehouse } from "./types";

// minmax(0,1fr): la columna de la bodega puede achicarse sin empujar la casilla fuera del borde.
const ROW = "grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3";
const READONLY_BOX =
  "flex h-9 items-center justify-end rounded-md border border-input bg-muted px-3 text-sm tabular-nums";

/**
 * S19-32: recuadro de stock del producto. Una fila con un desplegable de bodegas o sucursales
 * (la principal elegida de entrada) y la cantidad de la bodega elegida: se cambia de bodega y se
 * va ingresando su cantidad. Debajo, el stock total (suma en vivo) y el stock mínimo. Editable en
 * Inventario; en Vender el desplegable sirve para consultar y la cantidad es solo lectura.
 * `warehouses` llega con la principal primero (loadProducts ordena por is_default).
 */
export function StockBox({
  editable,
  warehouses,
  stock,
  minStock,
}: {
  editable: boolean;
  warehouses: Warehouse[];
  stock: WarehouseStock[];
  minStock: number;
}) {
  const t = useTranslations("catalog");
  const qtyAt = (id: string) =>
    stock.filter((s) => s.warehouseId === id).reduce((sum, s) => sum + s.qty, 0);

  const [selectedId, setSelectedId] = useState(warehouses[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(warehouses.map((w) => [w.id, String(qtyAt(w.id))])),
  );

  // Bodegas archivadas que todavía tienen stock: cuentan en el total, no se editan.
  const archivedQty = stock
    .filter((s) => !warehouses.some((w) => w.id === s.warehouseId))
    .reduce((sum, s) => sum + s.qty, 0);
  const total =
    warehouses.reduce((sum, w) => sum + (Number(values[w.id]) || 0), 0) + archivedQty;

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-dashed border-border p-3 sm:col-span-2">
      {warehouses.length > 0 ? (
        <div className={ROW}>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full min-w-0" aria-label={t("warehouse")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {editable ? (
            <Input
              aria-label={t("quantity")}
              type="number"
              min={0}
              step="0.001"
              value={values[selectedId] ?? "0"}
              onChange={(e) => setValues((prev) => ({ ...prev, [selectedId]: e.target.value }))}
              className="text-right"
            />
          ) : (
            <p className={READONLY_BOX}>{qtyAt(selectedId).toLocaleString("es-CO")}</p>
          )}
        </div>
      ) : null}

      {/* Se envían todas las bodegas; las que no cambiaron no generan ajuste (set_product_stock). */}
      {editable
        ? warehouses.map((w) => (
            <input key={w.id} type="hidden" name={`stock__${w.id}`} value={values[w.id] ?? "0"} />
          ))
        : null}

      <div className={`${ROW} border-t border-border pt-3`}>
        <span className="text-sm font-medium">{t("totalStock")}</span>
        <p className={`${READONLY_BOX} font-semibold`}>{total.toLocaleString("es-CO")}</p>
      </div>

      <div className={ROW}>
        <Label htmlFor="min_stock">{t("minStock")}</Label>
        {editable ? (
          <Input
            id="min_stock"
            name="min_stock"
            type="number"
            min={0}
            step="0.001"
            required
            defaultValue={minStock}
            className="text-right"
          />
        ) : (
          <p id="min_stock" className={READONLY_BOX}>
            {minStock.toLocaleString("es-CO")}
          </p>
        )}
      </div>
    </fieldset>
  );
}
