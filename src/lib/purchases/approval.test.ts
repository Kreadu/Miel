import { describe, expect, it } from "vitest";

import { purchaseNumber, purchaseStatusKey } from "./approval";

describe("purchaseNumber (S26-02)", () => {
  it("formatea OC con 4 dígitos", () => {
    expect(purchaseNumber(1)).toBe("OC-0001");
    expect(purchaseNumber(123)).toBe("OC-0123");
  });
  it("no recorta números de más de 4 dígitos", () => {
    expect(purchaseNumber(12345)).toBe("OC-12345");
  });
});

describe("purchaseStatusKey (S26-02)", () => {
  it("borrador sin aprobar = pendiente de aprobación", () => {
    expect(purchaseStatusKey("draft", null)).toBe("pending");
  });
  it("borrador ya aprobado (de un aprobador) = borrador (S26-09: sin estado \"Aprobada\")", () => {
    expect(purchaseStatusKey("draft", "2026-10-07T12:00:00Z")).toBe("draft");
  });
  it("los demás estados quedan igual", () => {
    expect(purchaseStatusKey("ordered", null)).toBe("ordered");
    expect(purchaseStatusKey("received", "2026-10-07T12:00:00Z")).toBe("received");
    expect(purchaseStatusKey("cancelled", null)).toBe("cancelled");
  });
});
