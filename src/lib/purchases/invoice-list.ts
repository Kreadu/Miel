import { z } from "zod";

import { historyFilters } from "@/lib/inventory-history";
import { round2 } from "@/lib/money";

/** S28-05: filtros de "Facturas de proveedores" (formulario GET). */
export type InvoiceListParams = { desde?: string; hasta?: string; proveedor?: string; q?: string; anuladas?: string };

export function invoiceFilters(params: InvoiceListParams, today: string) {
  // Mismas reglas de fechas que los historiales (del 1 del mes a hoy; al revés se invierten).
  const { from, to, warehouseId: supplierId } = historyFilters(
    { desde: params.desde, hasta: params.hasta, bodega: params.proveedor },
    today,
  );
  // Búsqueda por número: solo letras, números, guiones y espacios (va a un ilike).
  const q = z.string().trim().max(60).regex(/^[\p{L}\p{N} \-/.]*$/u).safeParse(params.q ?? "");
  return { from, to, supplierId, q: q.success ? q.data : "", voided: params.anuladas === "1" };
}

export type InvoiceRow = {
  issued_on: string;
  number: string;
  supplier: string;
  order: string;
  subtotal: number;
  tax: number;
  total: number;
  due_on: string | null;
  voided: boolean;
};

/** Totales del período (sin las anuladas). */
export function invoicesTotals(rows: InvoiceRow[]) {
  const live = rows.filter((r) => !r.voided);
  const sum = (k: "subtotal" | "tax" | "total") => round2(live.reduce((s, r) => s + Number(r[k]), 0));
  return { subtotal: sum("subtotal"), tax: sum("tax"), total: sum("total") };
}

const cell = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
const num = (n: number) => String(n).replace(".", ",");

/** CSV para Excel en Colombia: separador ";" y decimales con coma. */
export function invoicesCsv(rows: InvoiceRow[], header: string[]): string {
  return [
    header.map(cell).join(";"),
    ...rows.map((r) =>
      [r.issued_on, r.number, r.supplier, r.order, num(r.subtotal), num(r.tax), num(r.total), r.due_on ?? "", r.voided ? "x" : ""]
        .map((v, i) => (i >= 4 && i <= 6 ? v : cell(v)))
        .join(";"),
    ),
  ].join("\r\n");
}
