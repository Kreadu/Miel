import { purchaseNumber } from "@/lib/purchases/approval";
import type { createClient } from "@/lib/supabase/server";

import type { InvoiceRow, invoiceFilters } from "./invoice-list";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * S28-05: facturas de proveedores del período (RLS: solo dueño/admin las leen). La misma consulta
 * alimenta la página y la descarga CSV.
 */
export async function loadInvoiceRows(supabase: Supabase, f: ReturnType<typeof invoiceFilters>) {
  let query = supabase
    .from("purchase_invoices")
    .select("id, purchase_id, number, issued_on, due_on, subtotal, tax, total, file_path, voided_at, suppliers(name), purchases(number)")
    .gte("issued_on", f.from)
    .lte("issued_on", f.to)
    .order("issued_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (f.supplierId) query = query.eq("supplier_id", f.supplierId);
  if (f.q) query = query.ilike("number", `%${f.q}%`);
  if (!f.voided) query = query.is("voided_at", null);
  const { data, error } = await query;
  if (error) console.error("loadInvoiceRows:", error.code);

  return (data ?? []).map((i) => ({
    id: i.id,
    purchaseId: i.purchase_id,
    filePath: i.file_path,
    row: {
      issued_on: i.issued_on,
      number: i.number,
      supplier: i.suppliers?.name ?? "—",
      order: i.purchases ? purchaseNumber(i.purchases.number) : "—",
      subtotal: Number(i.subtotal),
      tax: Number(i.tax),
      total: Number(i.total),
      due_on: i.due_on,
      voided: i.voided_at != null,
    } satisfies InvoiceRow,
  }));
}
