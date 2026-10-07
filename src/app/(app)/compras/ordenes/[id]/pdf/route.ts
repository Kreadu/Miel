import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { buildPurchaseDoc } from "@/lib/purchases/pdf-data";
import { loadPdfLogo } from "@/lib/purchases/pdf-logo";
import { renderPurchasePdf } from "@/lib/purchases/purchase-pdf";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

const notFound = () => new Response("No encontrado", { status: 404 });

/**
 * S26-03: PDF de la orden de compra. Solo dueño/admin (lleva costos; un operativo o el modo tienda
 * reciben 404, igual que una orden ajena, inexistente o cancelada).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();

  const { active } = await getActiveTenant();
  if (!active || active.role === "member") return notFound();

  const supabase = await createClient();
  const [{ data: p }, { data: company }] = await Promise.all([
    supabase
      .from("purchases")
      .select(
        "number, status, created_at, issued_at, note, subtotal, tax, total, requested_by_name, requested_at, approved_by_name, approved_at, ordered_by_name, suppliers(name, nit, address, phone, email), purchase_items(qty, unit_cost, tax_rate, products(sku, name))",
      )
      .eq("id", id)
      .eq("tenant_id", active.tenantId)
      .maybeSingle(),
    supabase
      .from("tenants")
      .select("name, nit, address, city, phone, email, logo_url")
      .eq("id", active.tenantId)
      .single(),
  ]);
  if (!p || p.status === "cancelled" || !company) return notFound();

  const doc = buildPurchaseDoc({
    number: p.number,
    status: p.status,
    createdAt: p.created_at,
    issuedAt: p.issued_at,
    note: p.note,
    subtotal: p.subtotal,
    tax: p.tax,
    total: p.total,
    requestedByName: p.requested_by_name,
    requestedAt: p.requested_at,
    approvedByName: p.approved_by_name,
    approvedAt: p.approved_at,
    orderedByName: p.ordered_by_name,
    company,
    supplier: p.suppliers ?? { name: "—", nit: null, address: null, phone: null, email: null },
    items: p.purchase_items.map((i) => ({
      sku: i.products?.sku ?? "—",
      name: i.products?.name ?? "—",
      qty: Number(i.qty),
      unitCost: Number(i.unit_cost),
      taxRate: Number(i.tax_rate),
    })),
  });

  const t = await getTranslations("purchases.pdf");
  const pdf = await renderPurchasePdf(
    doc,
    {
      title: t("title"),
      date: t("date"),
      supplier: t("supplier"),
      sku: t("sku"),
      product: t("product"),
      qty: t("qty"),
      unitCost: t("unitCost"),
      taxPercent: t("taxPercent"),
      lineTotal: t("lineTotal"),
      subtotal: t("subtotal"),
      tax: t("tax"),
      total: t("total"),
      note: t("note"),
      draft: t("draft"),
      signatures: { requested: t("requestedBy"), approved: t("approvedBy"), ordered: t("orderedBy") },
    },
    await loadPdfLogo(company.logo_url, process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${doc.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
