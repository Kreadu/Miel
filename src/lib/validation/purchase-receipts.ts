import { z } from "zod";

import { round2 } from "@/lib/money";

const E = "purchases.receipt.errors";
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${E}.dateInvalid`);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => v || null);
/** Campo numérico opcional del formulario: "" o ausente = null. */
const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().pipe(schema).nullable());

const invoiceFields = {
  purchase_id: z.uuid(`purchases.errors.purchaseInvalid`),
  number: z.string().trim().min(1, `${E}.numberRequired`).max(60, `${E}.numberRequired`),
  issued_on: isoDate,
  due_on: z.preprocess((v) => v || null, isoDate.nullable()),
  cufe: optionalText(200),
  subtotal: z.coerce.number().min(0, `${E}.amountInvalid`),
  tax: z.coerce.number().min(0, `${E}.amountInvalid`),
};

/** Vencimiento no antes de la emisión; el total lo calcula el servidor (subtotal + IVA). */
function withTotals<T extends z.ZodType<{ issued_on: string; due_on: string | null; subtotal: number; tax: number }>>(schema: T) {
  return schema
    .refine((d) => !d.due_on || d.due_on >= d.issued_on, { message: `${E}.dueBeforeIssue`, path: ["due_on"] })
    .transform((d) => ({ ...d, subtotal: round2(d.subtotal), tax: round2(d.tax), total: round2(d.subtotal + d.tax) }));
}

/** S28-01: factura del proveedor. */
export const invoiceSchema = withTotals(
  // S26-11: con bodega por ítem la factura no la pide ("" = sin bodega).
  z.object({ ...invoiceFields, warehouse_id: z.preprocess((v) => v || null, z.uuid(`purchases.errors.warehouseInvalid`).nullable()) }),
);

/** S28-03: corregir una factura (la bodega no cambia). */
export const invoiceUpdateSchema = withTotals(z.object({ ...invoiceFields, invoice_id: z.uuid("purchases.errors.notFound") }));

/** S28-01/S28-02: una línea recibida. Sin costo (miembro) la RPC usa el de la orden. */
export const receiveLineSchema = z.object({
  invoice_id: z.uuid(`${E}.invoiceRequired`),
  purchase_item_id: z.uuid(`purchases.errors.itemsInvalid`),
  qty: z.coerce.number().positive("sales.errors.qtyPositive"),
  unit_cost: optionalNumber(z.number().min(0, "products.errors.costNegative")).default(null),
  tax_rate: optionalNumber(z.number().min(0, "products.errors.taxRange").max(100, "products.errors.taxRange")).default(null),
  sale_price: optionalNumber(z.number().min(0, `${E}.priceInvalid`)).default(null),
});

export const closeShortSchema = z.object({
  purchase_id: z.uuid(`purchases.errors.purchaseInvalid`),
  note: z.string().trim().max(500, "common.errors.noteTooLong").optional().or(z.literal("")),
});

/** Tipos de archivo de factura: PDF, XML o ZIP de la factura electrónica, o foto. */
export const INVOICE_FILE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/xml": "xml",
  "text/xml": "xml",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const MAX_INVOICE_FILE_BYTES = 10 * 1024 * 1024;

export function invoiceFileError(file: File): string | null {
  if (!INVOICE_FILE_TYPES[file.type]) return `${E}.fileType`;
  if (file.size > MAX_INVOICE_FILE_BYTES) return `${E}.fileSize`;
  return null;
}
