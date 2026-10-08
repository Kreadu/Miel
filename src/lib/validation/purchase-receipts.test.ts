import { describe, expect, it } from "vitest";

import { closeShortSchema, invoiceFileError, invoiceSchema, receiveLineSchema } from "./purchase-receipts";

const PID = "11111111-1111-4111-8111-111111111111";
const WID = "22222222-2222-4222-8222-222222222222";

describe("invoiceSchema (S28-01)", () => {
  const valid = { purchase_id: PID, warehouse_id: WID, number: " FE-123 ", issued_on: "2026-10-08", subtotal: "7200", tax: "1368" };

  it("acepta la factura y calcula el total = subtotal + IVA", () => {
    const r = invoiceSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ number: "FE-123", subtotal: 7200, tax: 1368, total: 8568, due_on: null, cufe: null });
  });

  it("vencimiento y CUFE opcionales", () => {
    const r = invoiceSchema.safeParse({ ...valid, due_on: "2026-11-08", cufe: "abc" });
    expect(r.data).toMatchObject({ due_on: "2026-11-08", cufe: "abc" });
  });

  it("rechaza número vacío, fecha inválida y valores negativos", () => {
    expect(invoiceSchema.safeParse({ ...valid, number: "  " }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...valid, issued_on: "08/10/2026" }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...valid, subtotal: "-1" }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...valid, tax: "-1" }).success).toBe(false);
  });

  it("rechaza vencimiento antes de la emisión", () => {
    expect(invoiceSchema.safeParse({ ...valid, due_on: "2026-10-01" }).success).toBe(false);
  });
});

describe("receiveLineSchema (S28-01/S28-02)", () => {
  const valid = { invoice_id: PID, purchase_item_id: WID, qty: "6", unit_cost: "1200", tax_rate: "19" };

  it("acepta una línea con costo e IVA", () => {
    expect(receiveLineSchema.safeParse(valid).data).toMatchObject({ qty: 6, unit_cost: 1200, tax_rate: 19, sale_price: null });
  });

  it("sin costo (miembro) queda null y el servidor usa el de la orden", () => {
    expect(receiveLineSchema.safeParse({ ...valid, unit_cost: "", tax_rate: "" }).data).toMatchObject({
      unit_cost: null,
      tax_rate: null,
    });
  });

  it("precio de venta opcional y no negativo", () => {
    expect(receiveLineSchema.safeParse({ ...valid, sale_price: "1700" }).data?.sale_price).toBe(1700);
    expect(receiveLineSchema.safeParse({ ...valid, sale_price: "-1" }).success).toBe(false);
  });

  it("rechaza cantidad 0 e IVA fuera de rango", () => {
    expect(receiveLineSchema.safeParse({ ...valid, qty: "0" }).success).toBe(false);
    expect(receiveLineSchema.safeParse({ ...valid, tax_rate: "101" }).success).toBe(false);
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
