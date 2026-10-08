import { describe, expect, it } from "vitest";

import { closeShortSchema, invoiceFileError, receiveInvoiceSchema } from "./purchase-receipts";

const PID = "11111111-1111-4111-8111-111111111111";
const WID = "22222222-2222-4222-8222-222222222222";

describe("receiveInvoiceSchema (S28-04)", () => {
  const line = { purchase_item_id: WID, warehouse_id: PID, qty: "6", unit_cost: "1200", tax_rate: "19", sale_price: "" };
  const valid = { purchase_id: PID, number: " FE-1 ", issued_on: "2026-10-08", lines: [line] };

  it("datos de la factura sin montos y líneas con cantidad", () => {
    const r = receiveInvoiceSchema.safeParse(valid);
    expect(r.data).toMatchObject({ number: "FE-1", due_on: null, cufe: null });
    expect(r.data?.lines[0]).toMatchObject({ qty: 6, unit_cost: 1200, tax_rate: 19, sale_price: null });
  });

  it("descarta las líneas en 0 y exige al menos una que llegó", () => {
    const r = receiveInvoiceSchema.safeParse({ ...valid, lines: [line, { ...line, qty: "0" }] });
    expect(r.data?.lines).toHaveLength(1);
    expect(receiveInvoiceSchema.safeParse({ ...valid, lines: [{ ...line, qty: "0" }] }).success).toBe(false);
  });

  it("miembro: sin costo ni IVA (la RPC usa los de la orden)", () => {
    const r = receiveInvoiceSchema.safeParse({ ...valid, lines: [{ ...line, unit_cost: "", tax_rate: "" }] });
    expect(r.data?.lines[0]).toMatchObject({ unit_cost: null, tax_rate: null });
  });

  it("rechaza número vacío, vencimiento antes de la factura y valores negativos", () => {
    expect(receiveInvoiceSchema.safeParse({ ...valid, number: " " }).success).toBe(false);
    expect(receiveInvoiceSchema.safeParse({ ...valid, due_on: "2026-10-01" }).success).toBe(false);
    expect(receiveInvoiceSchema.safeParse({ ...valid, lines: [{ ...line, unit_cost: "-1" }] }).success).toBe(false);
    expect(receiveInvoiceSchema.safeParse({ ...valid, lines: [{ ...line, sale_price: "-1" }] }).success).toBe(false);
  });
});

describe("closeShortSchema", () => {
  it("nota opcional de hasta 500", () => {
    expect(closeShortSchema.safeParse({ purchase_id: PID, note: "" }).success).toBe(true);
    expect(closeShortSchema.safeParse({ purchase_id: PID, note: "x".repeat(501) }).success).toBe(false);
  });
});

describe("invoiceFileError", () => {
  const file = (type: string, size = 10) => new File([new Uint8Array(size)], "f", { type });

  it("acepta PDF, XML, ZIP y fotos", () => {
    for (const t of ["application/pdf", "text/xml", "application/xml", "application/zip", "image/jpeg", "image/png"]) {
      expect(invoiceFileError(file(t))).toBeNull();
    }
  });

  it("rechaza otros tipos y más de 10 MB", () => {
    expect(invoiceFileError(file("text/html"))).toBe("purchases.receipt.errors.fileType");
    expect(invoiceFileError(file("application/pdf", 10 * 1024 * 1024 + 1))).toBe("purchases.receipt.errors.fileSize");
  });
});
