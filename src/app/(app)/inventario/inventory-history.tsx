import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { Warehouse } from "@/components/products/types";
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
import { formatMoney } from "@/lib/currency";
import type { InventoryConfig } from "@/lib/inventories";
import { historyFilters, todayInBogota } from "@/lib/inventory-history";
import { markupFromPrice } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export type HistoryParams = { historial?: string; desde?: string; hasta?: string; bodega?: string };

// Radix no admite value="" en un <Select>; "all" no es uuid y historyFilters lo lee como todas.
const ALL_WAREHOUSES = "all";

/**
 * S19-34: Historial de un inventario — cerrado hasta que se aprieta "Historial"; filtra por
 * rango de fechas y bodega o sucursal (formulario GET, todo server-side) y muestra por bodega:
 * código, producto, stock al final del rango, costo, % de venta y valor venta (stock × precio).
 */
export async function InventoryHistory({
  inventory,
  basePath,
  warehouses,
  currency,
  params,
}: {
  inventory: InventoryConfig;
  basePath: string;
  warehouses: Warehouse[];
  currency: string;
  params: HistoryParams;
}) {
  const t = await getTranslations("inventory.history");
  if (params.historial !== "1") {
    return (
      <div>
        <Button asChild variant="outline">
          <Link href={`${basePath}?historial=1`}>{t("open")}</Link>
        </Button>
      </div>
    );
  }

  const { from, to, warehouseId } = historyFilters(params, todayInBogota());
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("inventory_history", {
    p_inventory: inventory.id,
    p_from: from,
    p_to: to,
    p_warehouse_id: warehouseId ?? undefined,
  });
  if (error) console.error("inventory_history:", error.code, error.message);

  const list = rows ?? [];
  const totalSale = list.reduce((sum, r) => sum + Number(r.stock) * Number(r.price ?? 0), 0);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">{t("title")}</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href={basePath}>{t("close")}</Link>
        </Button>
      </div>

      <form method="get" action={basePath} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-4">
        <input type="hidden" name="historial" value="1" />
        <div className="flex flex-col gap-2">
          <Label htmlFor="desde">{t("from")}</Label>
          <Input id="desde" name="desde" type="date" defaultValue={from} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hasta">{t("to")}</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={to} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bodega">{t("warehouse")}</Label>
          <Select name="bodega" defaultValue={warehouseId ?? ALL_WAREHOUSES}>
            <SelectTrigger id="bodega" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_WAREHOUSES}>{t("all")}</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit">{t("view")}</Button>
      </form>

      {list.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("warehouse")}</th>
                <th className="px-3 py-2 font-medium">{t("code")}</th>
                <th className="px-3 py-2 font-medium">{t("product")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("stock")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("cost")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("markup")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("saleValue")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const stock = Number(r.stock);
                const cost = r.cost === null ? null : Number(r.cost);
                const price = Number(r.price ?? 0);
                const markup = cost === null ? null : markupFromPrice(cost, price);
                const sellable = inventory.sellable && price > 0;
                return (
                  <tr key={`${r.warehouse_id}-${r.product_id}`} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5">{r.warehouse_name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.sku}</td>
                    <td className="px-3 py-2.5 font-medium">
                      <Link
                        href={`/inventario/kardex/${r.product_id}?warehouse_id=${r.warehouse_id}`}
                        className="underline-offset-4 hover:underline"
                        title={t("viewKardex")}
                      >
                        {r.product_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {stock.toLocaleString("es-CO")}{" "}
                      <span className="text-xs text-muted-foreground">{r.unit}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {cost === null ? "—" : formatMoney(cost, currency)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {sellable && markup !== null ? `${markup.toLocaleString("es-CO")}%` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {sellable ? formatMoney(stock * price, currency) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {inventory.sellable ? (
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td className="px-3 py-2.5" colSpan={6}>
                    {t("totalSaleValue")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(totalSale, currency)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      )}
    </section>
  );
}
