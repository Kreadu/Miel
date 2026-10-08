"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { logActivity } from "@/lib/activity/log";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/server";
import {
  closeShortSchema,
  INVOICE_FILE_TYPES,
  invoiceFileError,
  invoiceUpdateSchema,
  receiveInvoiceSchema,
} from "@/lib/validation/purchase-receipts";

export type ReceiptState = { ok: false; error: string } | { ok: true } | null;

const E = "purchases.receipt.errors";
const BUCKET = "purchase-invoices";
const receivePath = (purchaseId: string) => `/compras/ordenes/${purchaseId}/recibir`;

function mapReceiptError(message: string | undefined): string {
  if (message?.includes("invoice_number_taken")) return `${E}.numberTaken`;
  if (message?.includes("invoice_below_payments")) return `${E}.belowPayments`;
  if (message?.includes("invoice_has_lines")) return `${E}.invoiceHasLines`;
  if (message?.includes("lines_required")) return `${E}.linesRequired`;
  if (message?.includes("invoice_voided")) return `${E}.invoiceVoided`;
  if (message?.includes("invoice_not_found")) return "purchases.errors.notFound";
  if (message?.includes("invoice_totals_invalid")) return `${E}.amountInvalid`;
  if (message?.includes("invoice_file_invalid")) return `${E}.fileType`;
  if (message?.includes("qty_exceeds_pending")) return `${E}.qtyExceedsPending`;
  if (message?.includes("qty_invalid")) return "sales.errors.qtyPositive";
  if (message?.includes("cost_invalid")) return "products.errors.costNegative";
  if (message?.includes("price_invalid")) return `${E}.priceInvalid`;
  if (message?.includes("purchase_not_receivable")) return `${E}.notReceivable`;
  if (message?.includes("purchase_not_partial")) return `${E}.notPartial`;
  if (message?.includes("line_already_voided")) return `${E}.alreadyVoided`;
  if (message?.includes("stock_insufficient")) return `${E}.voidNoStock`;
  if (message?.includes("warehouse_invalid")) return "purchases.errors.warehouseInvalid";
  if (message?.includes("permission_denied")) return "common.errors.permissionDenied";
  if (message?.includes("not_authenticated")) return "common.errors.signInAgain";
  if (message?.includes("purchase_not_found") || message?.includes("line_not_found")) return "purchases.errors.notFound";
  return `${E}.saveFailed`;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Sube el archivo de la factura (si vino) a la carpeta de la empresa. */
async function uploadInvoiceFile(
  supabase: Supabase,
  formData: FormData,
): Promise<{ ok: true; path: string | null } | { ok: false; error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: true, path: null };
  const fileError = invoiceFileError(file);
  if (fileError) return { ok: false, error: fileError };

  const { active } = await getActiveTenant();
  if (!active) return { ok: false, error: "common.errors.signInAgain" };
  const path = `${active.tenantId}/${crypto.randomUUID()}.${INVOICE_FILE_TYPES[file.type]}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) {
    console.error("uploadInvoiceFile:", error.message);
    return { ok: false, error: `${E}.uploadFailed` };
  }
  return { ok: true, path };
}

/**
 * S28-04: la factura y lo que llegó en un solo paso. Los totales los calcula la BD de las líneas;
 * cada línea entra en su bodega (reparto). Un miembro no manda costos: entran los de la orden.
 */
export async function receivePurchaseInvoice(_prev: ReceiptState, formData: FormData): Promise<ReceiptState> {
  let lines: unknown;
  try {
    lines = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { ok: false, error: `${E}.linesRequired` };
  }
  const parsed = receiveInvoiceSchema.safeParse({ ...Object.fromEntries(formData), lines });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const upload = await uploadInvoiceFile(supabase, formData);
  if (!upload.ok) return upload;
  const path = upload.path;

  const { error } = await supabase.rpc("receive_purchase_invoice", {
    p_purchase_id: d.purchase_id,
    p_number: d.number,
    p_issued_on: d.issued_on,
    p_due_on: d.due_on,
    p_cufe: d.cufe,
    p_file_path: path,
    p_lines: d.lines.map((l) => ({
      purchase_item_id: l.purchase_item_id,
      warehouse_id: l.warehouse_id,
      qty: l.qty,
      unit_cost: l.unit_cost,
      tax_rate: l.tax_rate,
      sale_price: l.sale_price,
    })),
  });
  if (error) {
    console.error("receivePurchaseInvoice:", error.message);
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: mapReceiptError(error.message) };
  }

  await logActivity("purchase_invoice_created", { entityId: d.purchase_id, detail: d.number });
  revalidatePath(receivePath(d.purchase_id));
  revalidatePath("/compras");
  return { ok: true };
}

/** S28-03: dueño/admin corrigen una factura; sin archivo nuevo se conserva el que tenía. */
export async function updatePurchaseInvoice(_prev: ReceiptState, formData: FormData): Promise<ReceiptState> {
  const parsed = invoiceUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const upload = await uploadInvoiceFile(supabase, formData);
  if (!upload.ok) return upload;
  const path = upload.path;

  const { error } = await supabase.rpc("update_purchase_invoice", {
    p_invoice_id: d.invoice_id,
    p_number: d.number,
    p_issued_on: d.issued_on,
    p_due_on: d.due_on,
    p_cufe: d.cufe,
    p_subtotal: d.subtotal,
    p_tax: d.tax,
    p_total: d.total,
    p_file_path: path,
  });
  if (error) {
    console.error("updatePurchaseInvoice:", error.message);
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: mapReceiptError(error.message) };
  }

  await logActivity("purchase_invoice_updated", { entityId: d.purchase_id, detail: d.number });
  revalidatePath(receivePath(d.purchase_id));
  revalidatePath("/compras");
  return { ok: true };
}

/** S28-03: dueño/admin anulan una factura sin líneas activas (la RPC lo valida). */
export async function voidPurchaseInvoice(purchaseId: string, invoiceId: string): Promise<ReceiptState> {
  const parsed = z.object({ purchaseId: z.uuid(), invoiceId: z.uuid() }).safeParse({ purchaseId, invoiceId });
  if (!parsed.success) return { ok: false, error: "purchases.errors.notFound" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_purchase_invoice", { p_invoice_id: parsed.data.invoiceId });
  if (error) {
    console.error("voidPurchaseInvoice:", error.message);
    return { ok: false, error: mapReceiptError(error.message) };
  }

  await logActivity("purchase_invoice_voided", { entityId: parsed.data.purchaseId });
  revalidatePath(receivePath(parsed.data.purchaseId));
  revalidatePath("/compras");
  return { ok: true };
}

/** S28-01 (R6): solo dueño/admin anulan una línea guardada por error (la RPC lo valida). */
export async function voidPurchaseReceiptLine(purchaseId: string, lineId: string): Promise<ReceiptState> {
  const parsed = z.object({ purchaseId: z.uuid(), lineId: z.uuid() }).safeParse({ purchaseId, lineId });
  if (!parsed.success) return { ok: false, error: "purchases.errors.notFound" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_purchase_receipt_line", { p_line_id: parsed.data.lineId });
  if (error) {
    console.error("voidPurchaseReceiptLine:", error.message);
    return { ok: false, error: mapReceiptError(error.message) };
  }

  await logActivity("purchase_line_voided", { entityId: parsed.data.purchaseId });
  revalidatePath(receivePath(parsed.data.purchaseId));
  revalidatePath("/compras");
  return { ok: true };
}

/** S28-01 (R4): el proveedor no mandará el resto; la orden queda recibida con faltantes. */
export async function closePurchaseShort(_prev: ReceiptState, formData: FormData): Promise<ReceiptState> {
  const parsed = closeShortSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_purchase_short", {
    p_purchase_id: parsed.data.purchase_id,
    p_note: parsed.data.note || null,
  });
  if (error) {
    console.error("closePurchaseShort:", error.message);
    return { ok: false, error: mapReceiptError(error.message) };
  }

  await logActivity("purchase_closed_short", { entityId: parsed.data.purchase_id });
  revalidatePath("/compras");
  redirect("/compras");
}
