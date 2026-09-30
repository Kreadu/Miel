import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant/server", () => ({ getActiveTenant: vi.fn(async () => ({ active: { tenantId: "t-1" } })) }));

const updateResult: { current: { data: { id: string }[] | null; error: { code: string } | null } } = {
  current: { data: [{ id: "w" }], error: null },
};
const eq = vi.fn(() => ({ select: async () => updateResult.current }));
const update = vi.fn(() => ({ eq }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ from: () => ({ update }) })) }));

const WH = "33333333-3333-4333-8333-333333333333";

describe("setWarehouseLends (S18-10: un clic para que una bodega preste stock)", () => {
  it("marca la bodega", async () => {
    updateResult.current = { data: [{ id: WH }], error: null };
    const { setWarehouseLends } = await import("./warehouses");

    expect(await setWarehouseLends(WH, true)).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ lends_stock: true });
    expect(eq).toHaveBeenCalledWith("id", WH);
  });

  it("un operativo no puede (RLS no actualiza nada)", async () => {
    updateResult.current = { data: [], error: null };
    const { setWarehouseLends } = await import("./warehouses");

    expect(await setWarehouseLends(WH, true)).toEqual({ ok: false, error: "common.errors.permissionDenied" });
  });

  it("id inválido", async () => {
    const { setWarehouseLends } = await import("./warehouses");
    expect(await setWarehouseLends("x", true)).toEqual({ ok: false, error: "stock.errors.warehouseInvalid" });
  });
});

describe("transferStock (S19-39)", () => {
  const TO = "44444444-4444-4444-8444-444444444444";
  const P = "55555555-5555-4555-8555-555555555555";

  it("sin productos: error sin llamar a la BD", async () => {
    const { transferStock } = await import("./warehouses");
    const fd = new FormData();
    fd.set("from", WH);
    fd.set("to", TO);
    fd.set("items", "[]");
    expect(await transferStock(null, fd)).toEqual({ ok: false, error: "warehouses.errors.transferItemsRequired" });
  });

  it("misma bodega: error", async () => {
    const { transferStock } = await import("./warehouses");
    const fd = new FormData();
    fd.set("from", WH);
    fd.set("to", WH);
    fd.set("items", JSON.stringify([{ product_id: P, qty: 2 }]));
    expect(await transferStock(null, fd)).toEqual({ ok: false, error: "warehouses.errors.transferSameWarehouse" });
  });
});
