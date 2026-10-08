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

  it("purchase_not_cancellable mapea a su clave", async () => {
    clientState.current = mockSupabase({ error: { message: "purchase_not_cancellable" } });
    const { cancelPurchase } = await import("./purchases");

    const result = await cancelPurchase("9b8b443a-a9c4-47c9-980f-cd90d14bda41");

    expect(result).toEqual({ ok: false, error: "purchases.errors.notCancellable" });
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

describe("S26-02 — aprobación", () => {
  const purchaseId = "9b8b443a-a9c4-47c9-980f-cd90d14bda41";
  const membershipId = "c5dc9a28-e7fd-4777-b12d-fddbe4e7efe3";

  it("approvePurchase invoca approve_purchase y revalida", async () => {
    clientState.current = mockSupabase({ error: null });
    const { approvePurchase } = await import("./purchases");

    const result = await approvePurchase(purchaseId);

    expect(clientState.current.rpc).toHaveBeenCalledWith("approve_purchase", { p_purchase_id: purchaseId });
    expect(result).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/compras");
  });

  it("approvePurchase rechaza un id inválido sin llamar a la BD", async () => {
    clientState.current = mockSupabase({ error: null });
    const { approvePurchase } = await import("./purchases");

    expect(await approvePurchase("x")).toEqual({ ok: false, error: "purchases.errors.purchaseInvalid" });
    expect(clientState.current.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["approval_required", "purchases.errors.approvalRequired"],
    ["display_name_required", "purchases.errors.displayNameRequired"],
    ["purchase_not_pending", "purchases.errors.notPending"],
    ["purchase_has_payments", "purchases.errors.hasPayments"],
  ])("%s mapea a %s", async (message, key) => {
    clientState.current = mockSupabase({ error: { message } });
    const { approvePurchase } = await import("./purchases");

    expect(await approvePurchase(purchaseId)).toEqual({ ok: false, error: key });
  });

  it("markPurchaseOrdered sin aprobación devuelve approvalRequired", async () => {
    clientState.current = mockSupabase({ error: { message: "approval_required" } });
    const { markPurchaseOrdered } = await import("./purchases");
    const fd = new FormData();
    fd.set("id", purchaseId);

    expect(await markPurchaseOrdered(null, fd)).toEqual({ ok: false, error: "purchases.errors.approvalRequired" });
  });

  it("setPurchaseApprover invoca set_purchase_approver con el booleano", async () => {
    clientState.current = mockSupabase({ error: null });
    const { setPurchaseApprover } = await import("./purchases");

    expect(await setPurchaseApprover(membershipId, true)).toEqual({ ok: true });
    expect(clientState.current.rpc).toHaveBeenCalledWith("set_purchase_approver", {
      p_membership_id: membershipId,
      p_value: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/equipo/usuarios");
  });

  it("setPurchaseApprover: approver_invalid y entrada inválida", async () => {
    clientState.current = mockSupabase({ error: { message: "approver_invalid" } });
    const { setPurchaseApprover } = await import("./purchases");

    expect(await setPurchaseApprover(membershipId, true)).toEqual({
      ok: false,
      error: "purchases.errors.approverInvalid",
    });
    expect(await setPurchaseApprover("x", true)).toEqual({ ok: false, error: "purchases.errors.approverInvalid" });
  });
});
