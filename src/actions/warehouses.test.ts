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
