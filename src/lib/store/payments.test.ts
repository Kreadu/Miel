import { describe, expect, it } from "vitest";

import { offeredPayments, paymentInstructions, parseStorePayments } from "./payments";

const full = {
  nequi: "300 123 4567",
  daviplata: null,
  transfer: "Bancolombia ahorros 123",
  qr: "https://x.co/qr.png",
  cash_on_delivery: false,
  in_store: true,
};

describe("formas de pago de la tienda (S27-03)", () => {
  it("lee el JSON de store_info y descarta lo raro", () => {
    expect(parseStorePayments(full)).toEqual(full);
    expect(parseStorePayments(null)).toEqual({
      nequi: null, daviplata: null, transfer: null, qr: null, cash_on_delivery: true, in_store: true,
    });
    expect(parseStorePayments({ nequi: 5, in_store: "sí" }).nequi).toBeNull();
  });

  it("ofrece solo lo configurado, y pagar al recoger solo si recoge", () => {
    const p = parseStorePayments(full);
    expect(offeredPayments(p, "pickup")).toEqual(["nequi", "transfer", "in_store"]);
    expect(offeredPayments(p, "delivery")).toEqual(["nequi", "transfer"]);
  });

  it("sin configurar nada: contra entrega y pagar al recoger (G2)", () => {
    expect(offeredPayments(parseStorePayments(null), "pickup")).toEqual(["cash_on_delivery", "in_store"]);
  });

  it("instrucciones por método", () => {
    const p = parseStorePayments(full);
    expect(paymentInstructions("nequi", p)).toEqual({ kind: "wallet", value: "300 123 4567" });
    expect(paymentInstructions("transfer", p)).toEqual({ kind: "bank", value: "Bancolombia ahorros 123" });
    expect(paymentInstructions("in_store", p)).toEqual({ kind: "offline" });
  });
});
