import { describe, expect, it, vi } from "vitest";

const rpcResult: { current: { data: unknown; error: { message: string } | null } } = {
  current: { data: [{ order_code: "ABCD1234", total: 26420, token: "tok" }], error: null },
};
const rpc = vi.fn(async () => rpcResult.current);
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ rpc })) }));

const P1 = "30000000-0000-0000-0000-000000027201";

function fd(fields: Record<string, string>) {
  const f = new FormData();
  const base = {
    slug: "dulce",
    name: "Luis",
    phone: "310 555 0001",
    email: "",
    delivery: "pickup",
    payment: "nequi",
    address: "",
    note: "",
    website: "",
    items: JSON.stringify([{ product_id: P1, qty: 2 }]),
  };
  for (const [k, v] of Object.entries({ ...base, ...fields })) f.set(k, v);
  return f;
}

describe("placeStoreOrder (S27-02)", () => {
  it("envía solo id y cantidad (nunca precios) y devuelve el código", async () => {
    rpcResult.current = { data: [{ order_code: "ABCD1234", total: 26420, token: "tok" }], error: null };
    rpc.mockClear();
    const { placeStoreOrder } = await import("./store-order");

    const res = await placeStoreOrder(null, fd({ items: JSON.stringify([{ product_id: P1, qty: 2, unit_price: 1 }]) }));

    expect(res).toEqual({ ok: true, code: "ABCD1234", total: 26420, token: "tok" });
    expect(rpc).toHaveBeenCalledWith("place_store_order", {
      p_slug: "dulce",
      p_customer: { name: "Luis", phone: "310 555 0001", email: null },
      p_items: [{ product_id: P1, qty: 2 }],
      p_delivery: "pickup",
      p_payment: "nequi",
      p_address: undefined,
      p_note: undefined,
    });
  });

  it("campo trampa lleno: responde como si nada y no crea el pedido", async () => {
    rpc.mockClear();
    const { placeStoreOrder } = await import("./store-order");

    const res = await placeStoreOrder(null, fd({ website: "http://spam" }));

    expect(res).toMatchObject({ ok: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: "" }, "onlineStore.order.errors.nameRequired"],
    [{ phone: "12" }, "onlineStore.order.errors.phoneInvalid"],
    [{ delivery: "delivery", address: " " }, "onlineStore.order.errors.addressRequired"],
    [{ items: "[]" }, "onlineStore.order.errors.cartEmpty"],
    [{ items: "{nope" }, "onlineStore.order.errors.cartEmpty"],
    [{ items: JSON.stringify([{ product_id: P1, qty: 100 }]) }, "onlineStore.order.errors.qtyInvalid"],
    [{ payment: "bitcoin" }, "onlineStore.order.errors.paymentInvalid"],
  ])("valida antes de la BD: %o → %s", async (fields, error) => {
    rpc.mockClear();
    const { placeStoreOrder } = await import("./store-order");

    expect(await placeStoreOrder(null, fd(fields))).toMatchObject({ ok: false, error });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["product_unavailable:Polen", { ok: false, error: "onlineStore.order.errors.productUnavailable", product: "Polen" }],
    ["too_many_orders", { ok: false, error: "onlineStore.order.errors.tooMany" }],
    ["store_unavailable", { ok: false, error: "onlineStore.order.errors.storeUnavailable" }],
    ["something internal", { ok: false, error: "onlineStore.order.errors.failed" }],
  ])("error de la BD %s", async (message, expected) => {
    rpcResult.current = { data: null, error: { message } };
    const { placeStoreOrder } = await import("./store-order");

    expect(await placeStoreOrder(null, fd({}))).toEqual(expected);
  });
});
