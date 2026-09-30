import Link from "next/link";

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
import { formatDate, formatMoney } from "@/lib/format";
import { historyFilters, todayInBogota } from "@/lib/inventory-history";
import { createClient } from "@/lib/supabase/server";

export type PurchaseHistoryParams = {
  historial?: string;
  desde?: string;
  hasta?: string;
  proveedor?: string;
};

const BASE_PATH = "/compras";
// Radix no admite value="" en un <Select>; "all" no es uuid y se lee como "todos".
const ALL_SUPPLIERS = "all";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  ordered: "Ordenada",
  received: "Recibida",
  cancelled: "Cancelada",
};

/**
 * S19-37: Historial de compras — cerrado hasta apretar "Historial"; filtra por rango de fechas
 * (hora de Bogotá) y proveedor con un formulario GET (todo server-side).
 */
export async function PurchaseHistory({
  suppliers,
  params,
}: {
  suppliers: { id: string; name: string }[];
  params: PurchaseHistoryParams;
}) {
  if (params.historial !== "1") {
    return (
      <div>
        <Button asChild variant="outline">
          <Link href={`${BASE_PATH}?historial=1`}>Historial</Link>
        </Button>
      </div>
    );
  }

  // Mismas reglas de fechas que el Historial de inventario (por defecto, del 1 del mes a hoy).
  const { from, to, warehouseId: supplierId } = historyFilters(
    { desde: params.desde, hasta: params.hasta, bodega: params.proveedor },
    todayInBogota(),
  );

  const supabase = await createClient();
  let query = supabase
    .from("purchases")
    .select("id, status, total, created_at, suppliers(name), purchase_items(id)")
    .gte("created_at", `${from}T00:00:00-05:00`)
    .lte("created_at", `${to}T23:59:59.999-05:00`)
    .order("created_at", { ascending: false });
  if (supplierId) query = query.eq("supplier_id", supplierId);
  const { data: rows } = await query;
  const list = rows ?? [];
  const total = list
    .filter((r) => r.status !== "cancelled")
    .reduce((sum, r) => sum + Number(r.total), 0);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">Historial de compras</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href={BASE_PATH}>Cerrar</Link>
        </Button>
      </div>

      <form method="get" action={BASE_PATH} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-4">
        <input type="hidden" name="historial" value="1" />
        <div className="flex flex-col gap-2">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={from} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={to} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="proveedor">Proveedor</Label>
          <Select name="proveedor" defaultValue={supplierId ?? ALL_SUPPLIERS}>
            <SelectTrigger id="proveedor" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SUPPLIERS}>Todos</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit">Ver</Button>
      </form>

      {list.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Proveedor</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Ítems</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5">{formatDate(r.created_at)}</td>
                  <td className="px-3 py-2.5">{r.suppliers?.name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{STATUS_LABEL[r.status] ?? r.status}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.purchase_items.length}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(Number(r.total))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="px-3 py-2.5" colSpan={4}>
                  Total comprado (sin canceladas)
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No hay compras en ese rango de fechas.
        </p>
      )}
    </section>
  );
}
