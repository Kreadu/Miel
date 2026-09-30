import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/tenant/server", () => ({
  getActiveTenant: vi.fn(async () => ({ active: { tenantId: "t-1" } })),
}));

const rpcResult: { current: { error: { code: string; message: string } | null } } = {
  current: { error: null },
};

const rpcSpy = vi.fn(async () => rpcResult.current);

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcSpy })),
}));

vi.mock("@/lib/customers/generic", () => ({
  getOrCreateGenericCustomerId: vi.fn(async () => "generic-1"),
}));

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const items = JSON.stringify([
  { product_id: "11111111-1111-4111-8111-111111111111", qty: 1 },
]);
const RATE = "22222222-2222-4222-8222-222222222222";

describe("createSale — forma de entrega (S19-35)", () => {
  it("transporte: manda tarifa y km a la RPC (el costo lo calcula la BD)", async () => {
    rpcResult.current = { error: null };
    rpcSpy.mockClear();
    const { createSale } = await import("./sales");

    const result = await createSale(
      null,
      formData({ items, delivery_method: "carrier", shipping_rate_id: RATE, shipping_km: "12", shipping_cost: "" }),
    );

    expect(result).toEqual({ ok: true });
    expect(rpcSpy).toHaveBeenCalledWith(
      "create_sale",
      expect.objectContaining({
        p_delivery_method: "carrier",
        p_shipping_rate_id: RATE,
        p_shipping_km: 12,
        p_shipping_cost: undefined,
      }),
    );
  });

  it("acordado sin monto → error sin llamar a la BD", async () => {
    rpcSpy.mockClear();
    const { createSale } = await import("./sales");

    const result = await createSale(
      null,
      formData({ items, delivery_method: "agreed", shipping_cost: "", shipping_km: "" }),
    );

    expect(result).toEqual({ ok: false, error: "sales.errors.agreedCostRequired" });
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("tarifa inválida en la BD → mensaje claro", async () => {
    rpcResult.current = { error: { code: "P0001", message: "shipping_rate_invalid" } };
    const { createSale } = await import("./sales");

    const result = await createSale(
      null,
      formData({ items, delivery_method: "carrier", shipping_rate_id: RATE, shipping_km: "3" }),
    );

    expect(result).toEqual({ ok: false, error: "sales.errors.shippingRateInvalid" });
  });
});

describe("confirmSale — caja cerrada (S19-22)", () => {
  it("cash_session_required → pide abrir la caja", async () => {
    rpcResult.current = { error: { code: "P0001", message: "cash_session_required" } };
    const { confirmSale } = await import("./sales");

    expect(await confirmSale("s-1", "w-1")).toEqual({
      ok: false,
      error: "sales.errors.cashSessionRequired",
    });
  });
});

describe("checkoutCounterSale — cobrar y entregar (S18-06)", () => {
  const WH = "33333333-3333-4333-8333-333333333333";
  const CUSTOMER = "44444444-4444-4444-8444-444444444444";
  const base = { items, payment_method: "card", warehouse_id: WH, document_type: "boleta", customer_id: "__counter__" };

  it("mostrador: manda todo a la RPC atómica con el cliente genérico", async () => {
    rpcResult.current = { error: null };
    rpcSpy.mockClear();
    const { checkoutCounterSale } = await import("./sales");

    expect(await checkoutCounterSale(null, formData(base))).toEqual({ ok: true });
    expect(rpcSpy).toHaveBeenCalledWith(
      "checkout_counter_sale",
      expect.objectContaining({
        p_tenant_id: "t-1",
        p_customer_id: "generic-1",
        p_payment_method: "card",
        p_warehouse_id: WH,
        p_document_type: "boleta",
      }),
    );
  });

  it("sin forma de pago: error sin llamar a la BD", async () => {
    rpcSpy.mockClear();
    const { checkoutCounterSale } = await import("./sales");

    expect(await checkoutCounterSale(null, formData({ ...base, payment_method: "" }))).toEqual({
      ok: false,
      error: "sales.errors.paymentMethodRequired",
    });
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("sin bodega válida: error sin llamar a la BD", async () => {
    rpcSpy.mockClear();
    const { checkoutCounterSale } = await import("./sales");

    expect(await checkoutCounterSale(null, formData({ ...base, warehouse_id: "" }))).toEqual({
      ok: false,
      error: "sales.errors.warehouseInvalid",
    });
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("factura sin cliente elegido: pide un cliente identificado", async () => {
    rpcSpy.mockClear();
    const { checkoutCounterSale } = await import("./sales");

    expect(await checkoutCounterSale(null, formData({ ...base, document_type: "factura" }))).toEqual({
      ok: false,
      error: "sales.errors.invoiceCustomerRequired",
    });
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("factura: la BD rechaza un cliente sin documento", async () => {
    rpcResult.current = { error: { code: "P0001", message: "invoice_customer_required" } };
    const { checkoutCounterSale } = await import("./sales");

    expect(
      await checkoutCounterSale(null, formData({ ...base, document_type: "factura", customer_id: CUSTOMER })),
    ).toEqual({ ok: false, error: "sales.errors.invoiceCustomerRequired" });
  });

  it("caja cerrada: pide abrir la caja", async () => {
    rpcResult.current = { error: { code: "P0001", message: "cash_session_required" } };
    const { checkoutCounterSale } = await import("./sales");

    expect(await checkoutCounterSale(null, formData(base))).toEqual({
      ok: false,
      error: "sales.errors.cashSessionRequired",
    });
  });
});

describe("markInvoiceIssued (S18-06)", () => {
  it("un operativo no puede: clave de permiso", async () => {
    rpcResult.current = { error: { code: "P0001", message: "permission_denied" } };
    const { markInvoiceIssued } = await import("./sales");

    expect(await markInvoiceIssued("55555555-5555-4555-8555-555555555555")).toEqual({
      ok: false,
      error: "common.errors.permissionDenied",
    });
  });
});

describe("cancelSale / refundSale — caja (S18-08)", () => {
  it("anular una venta cobrada manda a devolverla desde Caja", async () => {
    rpcResult.current = { error: { code: "P0001", message: "sale_has_payments" } };
    const { cancelSale } = await import("./sales");

    expect(await cancelSale("55555555-5555-4555-8555-555555555555")).toEqual({
      ok: false,
      error: "sales.errors.saleHasPayments",
    });
  });

  it("devolución sin motivo: error sin llamar a la BD", async () => {
    rpcSpy.mockClear();
    const { refundSale } = await import("./sales");

    expect(await refundSale(null, formData({ receipt_number: "12", reason: "  " }))).toEqual({
      ok: false,
      error: "cash.errors.refundReasonRequired",
    });
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("devolución: manda boleta y motivo a la RPC", async () => {
    rpcResult.current = { error: null };
    rpcSpy.mockClear();
    const { refundSale } = await import("./sales");

    expect(await refundSale(null, formData({ receipt_number: "12", reason: "Defectuoso" }))).toEqual({ ok: true });
    expect(rpcSpy).toHaveBeenCalledWith("refund_sale", {
      p_tenant_id: "t-1",
      p_receipt_number: 12,
      p_reason: "Defectuoso",
    });
  });

  it("devolución sin caja abierta: pide abrirla", async () => {
    rpcResult.current = { error: { code: "P0001", message: "cash_session_required" } };
    const { refundSale } = await import("./sales");

    expect(await refundSale(null, formData({ receipt_number: "12", reason: "x" }))).toEqual({
      ok: false,
      error: "cash.errors.refundCashRequired",
    });
  });
});
