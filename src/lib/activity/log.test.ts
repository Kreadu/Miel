import { describe, expect, it, vi } from "vitest";

const active = { current: { tenantId: "t-1", worker: { id: "w-1" } } as Record<string, unknown> | null };
vi.mock("@/lib/tenant/server", () => ({ getActiveTenant: vi.fn(async () => ({ active: active.current })) }));
const insert = vi.fn(async () => ({ error: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ from: () => ({ insert }) })) }));

describe("logActivity (S21-04)", () => {
  it("registra la acción con el trabajador del modo tienda", async () => {
    const { logActivity } = await import("./log");
    await logActivity("sale_confirmed", { entityId: "s-1", detail: "Boleta #12" });
    expect(insert).toHaveBeenCalledWith({
      tenant_id: "t-1",
      worker_id: "w-1",
      action: "sale_confirmed",
      entity_id: "s-1",
      detail: "Boleta #12",
    });
  });

  it("sin trabajador identificado queda a nombre de la cuenta (worker_id null)", async () => {
    active.current = { tenantId: "t-1", worker: null };
    const { logActivity } = await import("./log");
    await logActivity("cash_opened");
    expect(insert).toHaveBeenLastCalledWith(expect.objectContaining({ worker_id: null, entity_id: null, detail: null }));
  });

  it("si el registro falla, no rompe la operación", async () => {
    insert.mockResolvedValueOnce({ error: { code: "42501" } });
    const { logActivity } = await import("./log");
    await expect(logActivity("cash_closed")).resolves.toBeUndefined();
  });
});
