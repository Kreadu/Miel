import { describe, expect, it } from "vitest";

import { buildPurchaseDoc, type PurchaseDocInput } from "./pdf-data";

const base: PurchaseDocInput = {
  number: 7,
  status: "ordered",
  createdAt: "2026-10-01T15:00:00Z",
  issuedAt: "2026-10-02T15:00:00Z",
  note: "Entregar en bodega",
  subtotal: 350,
  tax: 38,
  total: 388,
  requestedByName: "Ana",
  requestedAt: "2026-10-01T15:00:00Z",
  approvedByName: "Dueña",
  approvedAt: "2026-10-01T16:00:00Z",
  orderedByName: "Dueña",
  company: { name: "Miel SAS", nit: "900123456-1", address: "Cra 1 # 2-3", city: "Bogotá", phone: "6011234567", email: null },
  supplier: { name: "Proveedor", nit: null, address: null, phone: "3001234567", email: "p@x.co" },
  items: [
    { sku: "A1", name: "Frasco", qty: 2, unitCost: 100, taxRate: 19 },
    { sku: "A2", name: "Etiqueta", qty: 3, unitCost: 50, taxRate: 0 },
  ],
};

describe("buildPurchaseDoc (S26-03)", () => {
  it("número, totales por línea y totales de la orden", () => {
    const doc = buildPurchaseDoc(base);
    expect(doc.number).toBe("OC-0007");
    expect(doc.items.map((i) => i.total)).toEqual([238, 150]);
    expect([doc.subtotal, doc.tax, doc.total]).toEqual([350, 38, 388]);
    expect(doc.date).toBe(base.issuedAt);
  });

  it("solo los renglones con dato de empresa y proveedor", () => {
    const doc = buildPurchaseDoc(base);
    expect(doc.companyLines).toEqual(["NIT 900123456-1", "Cra 1 # 2-3, Bogotá", "6011234567"]);
    expect(doc.supplierLines).toEqual(["3001234567", "p@x.co"]);
  });

  it("las tres firmas; la que falta queda sin nombre", () => {
    const doc = buildPurchaseDoc({ ...base, orderedByName: null });
    expect(doc.signatures).toEqual([
      { key: "requested", name: "Ana", date: base.requestedAt },
      { key: "approved", name: "Dueña", date: base.approvedAt },
      { key: "ordered", name: null, date: base.issuedAt },
    ]);
  });

  it("borrador sin aprobar lleva la marca; aprobado o ordenado no", () => {
    expect(buildPurchaseDoc({ ...base, status: "draft", approvedAt: null, approvedByName: null, issuedAt: null }).draft).toBe(true);
    expect(buildPurchaseDoc({ ...base, status: "draft", issuedAt: null }).draft).toBe(false);
    expect(buildPurchaseDoc(base).draft).toBe(false);
  });

  it("sin fecha de envío usa la de creación", () => {
    expect(buildPurchaseDoc({ ...base, issuedAt: null }).date).toBe(base.createdAt);
  });
});

describe("buildPurchaseDoc por bodega (S26-11)", () => {
  it("agrupa los productos por bodega con su dirección, en orden de aparición", () => {
    const norte = { name: "Norte", address: "Calle 80", city: "Medellín" };
    const doc = buildPurchaseDoc({
      ...base,
      items: [
        { sku: "A1", name: "Frasco", qty: 2, unitCost: 100, taxRate: 19, warehouse: { name: "Principal", address: null, city: null } },
        { sku: "A1", name: "Frasco", qty: 1, unitCost: 100, taxRate: 19, warehouse: norte },
        { sku: "A2", name: "Etiqueta", qty: 3, unitCost: 50, taxRate: 0, warehouse: norte },
      ],
    });
    expect(doc.groups.map((g) => [g.warehouse, g.address, g.items.length])).toEqual([
      ["Principal", "", 1],
      ["Norte", "Calle 80, Medellín", 2],
    ]);
  });

  it("orden vieja sin bodegas: un solo grupo sin encabezado", () => {
    const doc = buildPurchaseDoc(base);
    expect(doc.groups).toHaveLength(1);
    expect(doc.groups[0].warehouse).toBeNull();
    expect(doc.groups[0].items).toHaveLength(2);
  });
});
