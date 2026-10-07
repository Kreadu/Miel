import { describe, expect, it } from "vitest";

import { orderTimeline, parseOrderStatus } from "./order-status";

const raw = {
  code: "ABCD1234",
  created_at: "2026-10-07T15:00:00Z",
  status: "shipped",
  subtotal: 20000,
  tax: 0,
  shipping_cost: 5000,
  total: 25000,
  delivery: "delivery",
  payment: "nequi",
  payment_status: "proof_sent",
  can_upload: true,
  items: [{ name: "Miel", qty: 2, line_total: 20000 }],
  payments: { nequi: "300", daviplata: null, transfer: null, qr: null, cash_on_delivery: true, in_store: true },
};

describe("estado del pedido de la tienda (S27-04)", () => {
  it("lee la respuesta de la BD", () => {
    const o = parseOrderStatus(raw)!;
    expect(o).toMatchObject({ code: "ABCD1234", status: "shipped", total: 25000, shippingCost: 5000, paymentStatus: "proof_sent" });
    expect(o.items).toEqual([{ name: "Miel", qty: 2, lineTotal: 20000 }]);
    expect(o.payments.nequi).toBe("300");
  });

  it("null o basura → null (pedido no encontrado)", () => {
    expect(parseOrderStatus(null)).toBeNull();
    expect(parseOrderStatus({ nope: 1 })).toBeNull();
  });

  it("línea de tiempo: pasos hechos hasta el estado actual", () => {
    expect(orderTimeline("draft")).toEqual([
      { step: "received", done: true }, { step: "confirmed", done: false },
      { step: "shipped", done: false }, { step: "delivered", done: false },
    ]);
    expect(orderTimeline("shipped").map((s) => s.done)).toEqual([true, true, true, false]);
    expect(orderTimeline("delivered").every((s) => s.done)).toBe(true);
    expect(orderTimeline("cancelled")).toEqual([{ step: "received", done: true }, { step: "cancelled", done: true }]);
  });

  it("un pedido entregado sin pasar por enviado (recoger en tienda) marca todo", () => {
    expect(orderTimeline("delivered").map((s) => s.step)).toEqual(["received", "confirmed", "shipped", "delivered"]);
  });
});
