import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { formatDate, formatMoney } from "@/lib/format";
import { purchaseNumber } from "@/lib/purchases/approval";
import { pendingTotals } from "@/lib/purchases/line";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";

import { CloseShortForm } from "./close-short-form";
import { InvoiceActions } from "./invoice-actions";
import { InvoiceForm } from "./invoice-form";
import { ReceiveLineForm } from "./receive-line-form";
import { VoidLineButton } from "./void-line-button";

export async function generateMetadata() {
  const t = await getTranslations("purchases.receipt");
  return { title: `${t("title")} · Miel` };
}

/** S28-01/S28-02: recibir una orden con la factura del proveedor, línea por línea. */
export default async function ReceivePurchasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ factura?: string; nueva?: string }>;
}) {
  const { id } = await params;
  const { factura, nueva } = await searchParams;
  const { active } = await getActiveTenant();
  if (!active) notFound();
  const isAdmin = active.role !== "member";
  const t = await getTranslations("purchases.receipt");
  const tp = await getTranslations("purchases");

  const supabase = await createClient();
  const { data: purchase } = await supabase
    .from("purchases")
    .select(
      "id, number, status, closed_short, shortage_note, suppliers(name), purchase_items(id, qty, received_qty, unit_cost, tax_rate, product_id, warehouse_id, products(sku, name, photo_url), warehouses(name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!purchase) notFound();

  const items = purchase.purchase_items;
  const productIds = items.map((i) => i.product_id);
  const [warehousesRes, invoicesRes, productsRes, stockRes] = await Promise.all([
    supabase.from("warehouses").select("id, name").eq("active", true).order("name"),
    // RLS: solo dueño/admin leen facturas y líneas (tienen costos).
    supabase
      .from("purchase_invoices")
      .select(
        "id, number, issued_on, due_on, cufe, subtotal, tax, total, file_path, voided_at, warehouses(name), purchase_receipt_lines(id, purchase_item_id, qty, unit_cost, tax_rate, voided_at, created_at)",
      )
      .eq("purchase_id", id)
      .order("created_at"),
    isAdmin
      ? supabase.from("products_catalog").select("id, cost, price").in("id", productIds)
      : Promise.resolve({ data: [] as { id: string | null; cost: number | null; price: number | null }[] }),
    isAdmin
      ? supabase.from("current_stock").select("product_id, total_qty").in("product_id", productIds)
      : Promise.resolve({ data: [] as { product_id: string | null; total_qty: number | null }[] }),
  ]);

  const warehouses = warehousesRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const productById = new Map((productsRes.data ?? []).map((p) => [p.id, p]));
  const stockByProduct = new Map<string, number>();
  for (const s of stockRes.data ?? []) {
    if (s.product_id) stockByProduct.set(s.product_id, (stockByProduct.get(s.product_id) ?? 0) + Number(s.total_qty ?? 0));
  }

  // Enlaces firmados de corta duración para "Ver archivo" (bucket privado).
  const filePaths = invoices.map((i) => i.file_path).filter((p): p is string => !!p);
  const signed = filePaths.length
    ? (await supabase.storage.from("purchase-invoices").createSignedUrls(filePaths, 600)).data ?? []
    : [];
  const fileUrl = new Map(signed.map((s) => [s.path, s.signedUrl]));

  const receivable = purchase.status === "ordered" || purchase.status === "partially_received";
  // La factura activa es la de la URL (recién creada); el dueño también puede elegir otra.
  const liveInvoices = invoices.filter((i) => !i.voided_at);
  const urlInvoice = factura && !invoices.some((i) => i.id === factura && i.voided_at) ? factura : undefined;
  const activeInvoice =
    receivable && !nueva ? (urlInvoice ?? (isAdmin ? liveInvoices.at(-1)?.id : undefined)) : undefined;
  const activeInvoiceNumber = invoices.find((i) => i.id === activeInvoice)?.number;
  const pendingTotal = items.reduce((sum, i) => sum + Math.max(Number(i.qty) - Number(i.received_qty), 0), 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Link href="/compras" aria-label={t("back")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">
            {t("title")} {purchaseNumber(purchase.number)}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {purchase.suppliers?.name ?? "—"} ·{" "}
          {tp.has(`statuses.${purchase.status}`) ? tp(`statuses.${purchase.status}`) : purchase.status}
          {purchase.closed_short ? ` · ${t("closedShort")}` : ""}
        </p>
        {purchase.shortage_note ? <p className="mt-1 text-sm text-muted-foreground">{purchase.shortage_note}</p> : null}
      </div>

      {isAdmin && invoices.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold tracking-tight">{t("invoices")}</h2>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {invoices.map((inv) => {
              const url = inv.file_path ? fileUrl.get(inv.file_path) : undefined;
              const linesTotal = inv.purchase_receipt_lines
                .filter((l) => !l.voided_at)
                .reduce((s, l) => s + Number(l.qty) * Number(l.unit_cost) * (1 + Number(l.tax_rate) / 100), 0);
              const mismatch = Math.abs(linesTotal - Number(inv.total)) >= 1;
              return (
                <li key={inv.id} className="flex flex-col gap-1 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={inv.voided_at ? "font-medium text-muted-foreground line-through" : "font-medium"}>
                      {inv.number}
                      {inv.id === activeInvoice ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">{t("activeInvoice")}</span>
                      ) : null}
                    </span>
                    <span className="tabular-nums">${formatMoney(inv.total)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{t("issuedOn", { date: formatDate(inv.issued_on) })}</span>
                    {inv.due_on ? <span>{t("dueOn", { date: formatDate(inv.due_on) })}</span> : null}
                    <span>{inv.warehouses?.name}</span>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
                        <FileText className="size-3.5" />
                        {t("viewFile")}
                      </a>
                    ) : null}
                    {inv.voided_at ? <span>{t("voidedInvoice")}</span> : null}
                    {receivable && !inv.voided_at && inv.id !== activeInvoice ? (
                      <Link href={`?factura=${inv.id}`} className="underline">
                        {t("useInvoice")}
                      </Link>
                    ) : null}
                  </div>
                  {!inv.voided_at && purchase.status !== "cancelled" ? (
                    <InvoiceActions
                      purchaseId={purchase.id}
                      invoice={{
                        id: inv.id,
                        number: inv.number,
                        issued_on: inv.issued_on,
                        due_on: inv.due_on,
                        cufe: inv.cufe,
                        subtotal: Number(inv.subtotal),
                        tax: Number(inv.tax),
                      }}
                      canVoid={inv.purchase_receipt_lines.every((l) => l.voided_at)}
                    />
                  ) : null}
                  {!inv.voided_at && mismatch && linesTotal > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("mismatch", { lines: `$${formatMoney(linesTotal)}` })}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {receivable && !activeInvoice ? (
        <InvoiceForm
          purchaseId={purchase.id}
          warehouses={warehouses}
          // S26-11: solo las órdenes viejas (ítems sin bodega) piden bodega en la factura.
          askWarehouse={items.some((i) => !i.warehouse_id)}
          expected={isAdmin ? pendingTotals(items) : undefined}
        />
      ) : null}

      {receivable && activeInvoice && isAdmin ? (
        <Link href="?nueva=1" className="self-start text-sm underline">
          {t("newInvoice")}
        </Link>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">
          {activeInvoiceNumber ? t("linesFor", { number: activeInvoiceNumber }) : t("lines")}
        </h2>
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const product = productById.get(item.product_id);
            const lines = invoices.flatMap((inv) =>
              inv.purchase_receipt_lines
                .filter((l) => l.purchase_item_id === item.id)
                .map((l) => ({ ...l, invoiceNumber: inv.number })),
            );
            const pending = Math.max(Number(item.qty) - Number(item.received_qty), 0);
            return (
              <li key={item.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  {item.products?.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.products.photo_url} alt="" className="size-12 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="size-12 shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.products?.name ?? "—"}
                      {item.warehouses?.name ? (
                        <span className="font-normal text-muted-foreground"> → {item.warehouses.name}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {t("progress", { ordered: Number(item.qty), received: Number(item.received_qty), pending })}
                    </p>
                  </div>
                </div>

                {isAdmin && lines.length > 0 ? (
                  <ul className="flex flex-col gap-1 text-xs">
                    {lines.map((l) => (
                      <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className={l.voided_at ? "text-muted-foreground line-through" : "text-muted-foreground"}>
                          {t("savedLine", {
                            qty: Number(l.qty),
                            cost: `$${formatMoney(l.unit_cost)}`,
                            invoice: l.invoiceNumber,
                          })}
                        </span>
                        {!l.voided_at && purchase.status !== "cancelled" ? (
                          <VoidLineButton purchaseId={purchase.id} lineId={l.id} />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {activeInvoice && pending > 0 ? (
                  <ReceiveLineForm
                    key={`${item.id}-${item.received_qty}`}
                    purchaseId={purchase.id}
                    invoiceId={activeInvoice}
                    itemId={item.id}
                    pending={pending}
                    isAdmin={isAdmin}
                    orderCost={isAdmin ? Number(item.unit_cost) : 0}
                    orderTax={isAdmin ? Number(item.tax_rate) : 0}
                    product={
                      isAdmin && product
                        ? {
                            stock: stockByProduct.get(item.product_id) ?? 0,
                            cost: Number(product.cost ?? 0),
                            price: Number(product.price ?? 0),
                          }
                        : null
                    }
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {purchase.status === "partially_received" ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <h2 className="text-base font-semibold tracking-tight">{t("pendingTitle", { count: pendingTotal })}</h2>
          <p className="text-sm text-muted-foreground">{t("pendingHelp")}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Link
              href="/compras"
              className="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              {t("keepPending")}
            </Link>
            <CloseShortForm purchaseId={purchase.id} />
          </div>
        </section>
      ) : null}

      {!receivable && purchase.status !== "received" ? (
        <p className="text-sm text-muted-foreground">{t("notReceivable")}</p>
      ) : null}
    </div>
  );
}
