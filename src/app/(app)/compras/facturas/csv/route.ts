import { getTranslations } from "next-intl/server";

import { todayInBogota } from "@/lib/inventory-history";
import { invoiceFilters, invoicesCsv } from "@/lib/purchases/invoice-list";
import { loadInvoiceRows } from "@/lib/purchases/invoice-list-query";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

/** S28-05: descarga CSV de las facturas de proveedores filtradas (solo dueño/admin: son costos). */
export async function GET(request: Request) {
  const { active } = await getActiveTenant();
  if (!active || active.role === "member") return new Response("No encontrado", { status: 404 });

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const f = invoiceFilters(params, todayInBogota());
  const rows = await loadInvoiceRows(await createClient(), f);
  const t = await getTranslations("purchases.invoices");
  const csv = invoicesCsv(
    rows.map((r) => r.row),
    ["date", "number", "supplier", "order", "subtotal", "tax", "total", "due", "voided"].map((k) => t(`columns.${k}`)),
  );

  // BOM: Excel abre el CSV en UTF-8 (tildes y ñ).
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="facturas-proveedores-${f.from}-a-${f.to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
