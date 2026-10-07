// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildPurchaseDoc } from "./pdf-data";
import { renderPurchasePdf, type PurchasePdfLabels } from "./purchase-pdf";

const labels: PurchasePdfLabels = {
  title: "Orden de compra",
  date: "Fecha",
  supplier: "Proveedor",
  sku: "SKU",
  product: "Producto",
  qty: "Cant.",
  unitCost: "Costo unit.",
  taxPercent: "IVA %",
  lineTotal: "Total",
  subtotal: "Subtotal",
  tax: "IVA",
  total: "Total",
  note: "Nota",
  draft: "BORRADOR — sin aprobar",
  signatures: { requested: "Pedida por", approved: "Aprobada por", ordered: "Enviada por" },
};

describe("renderPurchasePdf (S26-03)", () => {
  it("produce un PDF con tildes, sin logo y con firmas vacías", async () => {
    const doc = buildPurchaseDoc({
      number: 1,
      status: "draft",
      createdAt: "2026-10-07T15:00:00Z",
      issuedAt: null,
      note: "Entregar mañana",
      subtotal: 100,
      tax: 19,
      total: 119,
      requestedByName: "José Peña",
      requestedAt: "2026-10-07T15:00:00Z",
      approvedByName: null,
      approvedAt: null,
      orderedByName: null,
      company: { name: "Miel SAS", nit: "900", address: null, city: "Bogotá", phone: null, email: null },
      supplier: { name: "Proveedor Ñandú", nit: null, address: null, phone: null, email: null },
      items: [{ sku: "A1", name: "Azúcar", qty: 1, unitCost: 100, taxRate: 19 }],
    });

    const pdf = await renderPurchasePdf(doc, labels, null);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  }, 20000);
});
