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
  { product_id: "11111111-1111-4111-8111-111111111111", qty: 1, unit_price: 100 },
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

    expect(result).toEqual({ ok: false, error: "Escribe el valor del envío acordado." });
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("tarifa inválida en la BD → mensaje claro", async () => {
    rpcResult.current = { error: { code: "P0001", message: "shipping_rate_invalid" } };
    const { createSale } = await import("./sales");

    const result = await createSale(
      null,
      formData({ items, delivery_method: "carrier", shipping_rate_id: RATE, shipping_km: "3" }),
    );

    expect(result).toEqual({ ok: false, error: "El transporte elegido no es válido." });
  });
});

describe("confirmSale — caja cerrada (S19-22)", () => {
  it("cash_session_required → pide abrir la caja", async () => {
    rpcResult.current = { error: { code: "P0001", message: "cash_session_required" } };
    const { confirmSale } = await import("./sales");

    expect(await confirmSale("s-1", "w-1")).toEqual({
      ok: false,
      error: "Abre tu caja para generar la boleta: el pedido tiene productos que se venden en tienda.",
    });
  });
});
