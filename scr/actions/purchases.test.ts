import { describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

function mockSupabase(rpcResult: { error: { message: string } | null }) {
  return { rpc: vi.fn(async () => rpcResult) };
}

const clientState: { current: ReturnType<typeof mockSupabase> } = {
  current: mockSupabase({ error: null }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => clientState.current),
}));

function itemsFormData(fields: Record<string, string>, items: unknown) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  fd.set("items", JSON.stringify(items));
  return fd;
}

describe("receivePurchase", () => {
  it("invoca receive_purchase con los params correctos y revalida", async () => {
    clientState.current = mockSupabase({ error: null });
    const { receivePurchase } = await import("./purchases");

    const purchaseId = "9b8b443a-a9c4-47c9-980f-cd90d14bda41";
    const warehouseId = "c5dc9a28-e7fd-4777-b12d-fddbe4e7efe3";
    const result = await receivePurchase(purchaseId, warehouseId);

    expect(clientState.current.rpc).toHaveBeenCalledWith("receive_purchase", {
      p_purchase_id: purchaseId,
      p_warehouse_id: warehouseId,
    });
    expect(result).toMatchObject({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/compras/ordenes");
  });

  it("warehouse_invalid mapea a mensaje en español", async () => {
    clientState.current = mockSupabase({ error: { message: "warehouse_invalid" } });
    const { receivePurchase } = await import("./purchases");

    const result = await receivePurchase(
      "9b8b443a-a9c4-47c9-980f-cd90d14bda41",
      "c5dc9a28-e7fd-4777-b12d-fddbe4e7efe3",
    );

    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).not.toContain("warehouse_invalid");
    expect((result as { error: string }).error.toLowerCase()).toContain("bodega");
  });

  it("purchase_not_ordered mapea a mensaje propio", async () => {
    clientState.current = mockSupabase({ error: { message: "purchase_not_ordered" } });
    const { receivePurchase } = await import("./purchases");

    const result = await receivePurchase(
      "9b8b443a-a9c4-47c9-980f-cd90d14bda41",
      "c5dc9a28-e7fd-4777-b12d-fddbe4e7efe3",
    );

    expect((result as { error: string }).error).not.toContain("purchase_not_ordered");
  });
});

describe("cancelPurchase", () => {
  it("invoca cancel_purchase y revalida", async () => {
    clientState.current = mockSupabase({ error: null });
    const { cancelPurchase } = await import("./purchases");

    const purchaseId = "9b8b443a-a9c4-47c9-980f-cd90d14bda41";
    const result = await cancelPurchase(purchaseId);

    expect(clientState.current.rpc).toHaveBeenCalledWith("cancel_purchase", {
      p_purchase_id: purchaseId,
    });
    expect(result).toMatchObject({ ok: true });
  });

  it("purchase_not_cancellable mapea a mensaje en español", async () => {
    clientState.current = mockSupabase({ error: { message: "purchase_not_cancellable" } });
    const { cancelPurchase } = await import("./purchases");

    const result = await cancelPurchase("9b8b443a-a9c4-47c9-980f-cd90d14bda41");

    expect((result as { error: string }).error).not.toContain("purchase_not_cancellable");
  });
});

describe("updatePurchase", () => {
  it("rechaza ítems inválidos sin llamar la RPC", async () => {
    clientState.current = mockSupabase({ error: null });
    const { updatePurchase } = await import("./purchases");

    const fd = itemsFormData(
      { id: "9b8b443a-a9c4-47c9-980f-cd90d14bda41", supplier_id: "c5dc9a28-e7fd-4777-b12d-fddbe4e7efe3" },
      [],
    );
    const result = await updatePurchase(null, fd);

    expect(result).toMatchObject({ ok: false });
    expect(clientState.current.rpc).not.toHaveBeenCalled();
  });

  it("caso feliz invoca update_purchase con los params correctos", async () => {
    clientState.current = mockSupabase({ error: null });
    const { updatePurchase } = await import("./purchases");

    const id = "9b8b443a-a9c4-47c9-980f-cd90d14bda41";
    const supplierId = "c5dc9a28-e7fd-4777-b12d-fddbe4e7efe3";
    const productId = "9e38affe-7e76-423e-ac57-6320d63c17db";
    const fd = itemsFormData({ id, supplier_id: supplierId }, [
      { product_id: productId, qty: "2", unit_cost: "10", tax_rate: "0" },
    ]);

    const result = await updatePurchase(null, fd);

    expect(result).toMatchObject({ ok: true });
    expect(clientState.current.rpc).toHaveBeenCalledWith("update_purchase", {
      p_purchase_id: id,
      p_supplier_id: supplierId,
      p_items: [{ product_id: productId, qty: 2, unit_cost: 10, tax_rate: 0 }],
      p_note: undefined,
    });
  });
});
