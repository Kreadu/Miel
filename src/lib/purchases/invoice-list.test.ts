import { describe, expect, it } from "vitest";

import { invoiceFilters, invoicesCsv, invoicesTotals } from "./invoice-list";

const SUP = "11111111-1111-4111-8111-111111111111";

describe("invoiceFilters (S28-05)", () => {
  it("por defecto, del 1 del mes a hoy, todos los proveedores, sin anuladas", () => {
    expect(invoiceFilters({}, "2026-10-08")).toEqual({
      from: "2026-10-01",
      to: "2026-10-08",
      supplierId: null,
      q: "",
      voided: false,
    });
  });

  it("lee proveedor, búsqueda y anuladas; ignora basura e invierte fechas al revés", () => {
    expect(
      invoiceFilters({ desde: "2026-10-08", hasta: "2026-09-01", proveedor: SUP, q: "  fe-12 ", anuladas: "1" }, "2026-10-08"),
    ).toEqual({ from: "2026-09-01", to: "2026-10-08", supplierId: SUP, q: "fe-12", voided: true });
    expect(invoiceFilters({ proveedor: "all", q: "%_" }, "2026-10-08")).toMatchObject({ supplierId: null, q: "" });
  });
});

const rows = [
  { issued_on: "2026-10-02", number: "FE-1", supplier: "Abejas; SAS", order: "OC-0001", subtotal: 7200, tax: 1368, total: 8568, due_on: null, voided: false },
  { issued_on: "2026-10-05", number: "FE-2", supplier: "Polen", order: "OC-0002", subtotal: 1000.5, tax: 0, total: 1000.5, due_on: "2026-11-05", voided: true },
];

describe("invoicesTotals", () => {
  it("suma solo las facturas no anuladas", () => {
    expect(invoicesTotals(rows)).toEqual({ subtotal: 7200, tax: 1368, total: 8568 });
  });
});

describe("invoicesCsv", () => {
  it("separado por ; con decimales con coma (Excel en Colombia) y textos con ; entre comillas", () => {
    const csv = invoicesCsv(rows, ["Fecha", "Número", "Proveedor", "Orden", "Subtotal", "IVA", "Total", "Vence", "Anulada"]);
    expect(csv.split("\r\n")).toEqual([
      "Fecha;Número;Proveedor;Orden;Subtotal;IVA;Total;Vence;Anulada",
      '2026-10-02;FE-1;"Abejas; SAS";OC-0001;7200;1368;8568;;',
      "2026-10-05;FE-2;Polen;OC-0002;1000,5;0;1000,5;2026-11-05;x",
    ]);
  });
});
