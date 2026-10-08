import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`);
});
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/activity/log", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/tenant/server", () => ({
  getActiveTenant: vi.fn(async () => ({ active: { tenantId: "t-1", role: "owner" } })),
}));

const upload = vi.fn(async () => ({ error: null as { message: string } | null }));
const remove = vi.fn(async () => ({ error: null }));
const rpc = vi.fn(async (): Promise<{ data: unknown; error: { message: string } | null }> => ({ data: "inv-1", error: null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc, storage: { from: () => ({ upload, remove }) } })),
}));

const PID = "11111111-1111-4111-8111-111111111111";
const WID = "22222222-2222-4222-8222-222222222222";
const IID = "33333333-3333-4333-8333-333333333333";

function fd(fields: Record<string, string | File>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockImplementation(async () => ({ data: "inv-1", error: null }));
});

describe("receivePurchaseInvoice (S28-04)", () => {
  const lines = [
    { purchase_item_id: WID, warehouse_id: IID, qty: "4", unit_cost: "1200", tax_rate: "19", sale_price: "" },
    { purchase_item_id: WID, warehouse_id: PID, qty: "2", unit_cost: "1200", tax_rate: "19", sale_price: "" },
    { purchase_item_id: IID, warehouse_id: PID, qty: "0", unit_cost: "", tax_rate: "", sale_price: "" },
  ];
  const base = { purchase_id: PID, number: "FE-1", issued_on: "2026-10-08", lines: JSON.stringify(lines) };

  it("sube el archivo, guarda la factura con las líneas que llegaron y revalida", async () => {
    const { receivePurchaseInvoice } = await import("./purchase-receipts");
    const file = new File(["%PDF"], "factura.pdf", { type: "application/pdf" });
    expect(await receivePurchaseInvoice(null, fd({ ...base, file }))).toEqual({ ok: true });
    const path = (upload.mock.calls[0] as unknown[])[0] as string;
    expect(path).toMatch(/^t-1\/[0-9a-f-]{36}\.pdf$/);
    expect(rpc).toHaveBeenCalledWith("receive_purchase_invoice", {
      p_purchase_id: PID,
      p_number: "FE-1",
      p_issued_on: "2026-10-08",
      p_due_on: null,
      p_cufe: null,
      p_file_path: path,
      p_lines: [
        { purchase_item_id: WID, warehouse_id: IID, qty: 4, unit_cost: 1200, tax_rate: 19, sale_price: null },
        { purchase_item_id: WID, warehouse_id: PID, qty: 2, unit_cost: 1200, tax_rate: 19, sale_price: null },
      ],
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/compras/ordenes/${PID}/recibir`);
  });

  it("número repetido: error claro y borra el archivo subido", async () => {
    rpc.mockImplementation(async () => ({ data: null, error: { message: "invoice_number_taken" } }));
    const { receivePurchaseInvoice } = await import("./purchase-receipts");
    const file = new File(["x"], "f.png", { type: "image/png" });
    expect(await receivePurchaseInvoice(null, fd({ ...base, file }))).toEqual({
      ok: false,
      error: "purchases.receipt.errors.numberTaken",
    });
    expect(remove).toHaveBeenCalled();
  });

  it("nada llegó: no llama a la base", async () => {
    const { receivePurchaseInvoice } = await import("./purchase-receipts");
    const zero = JSON.stringify([{ ...lines[0], qty: "0" }]);
    expect(await receivePurchaseInvoice(null, fd({ ...base, lines: zero }))).toEqual({
      ok: false,
      error: "purchases.receipt.errors.linesRequired",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("más de lo pendiente se traduce", async () => {
    rpc.mockImplementation(async () => ({ data: null, error: { message: "qty_exceeds_pending" } }));
    const { receivePurchaseInvoice } = await import("./purchase-receipts");
    expect(await receivePurchaseInvoice(null, fd(base))).toEqual({
      ok: false,
      error: "purchases.receipt.errors.qtyExceedsPending",
    });
  });
});

describe("voidPurchaseReceiptLine y closePurchaseShort", () => {
  it("anula la línea", async () => {
    const { voidPurchaseReceiptLine } = await import("./purchase-receipts");
    expect(await voidPurchaseReceiptLine(PID, IID)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("void_purchase_receipt_line", { p_line_id: IID });
  });

  it("sin stock para anular se traduce", async () => {
    rpc.mockImplementation(async () => ({ data: null, error: { message: "stock_insufficient" } }));
    const { voidPurchaseReceiptLine } = await import("./purchase-receipts");
    expect(await voidPurchaseReceiptLine(PID, IID)).toEqual({ ok: false, error: "purchases.receipt.errors.voidNoStock" });
  });

  it("cierra con faltantes y vuelve a Compras", async () => {
    const { closePurchaseShort } = await import("./purchase-receipts");
    await expect(closePurchaseShort(null, fd({ purchase_id: PID, note: "No hay más" }))).rejects.toThrow("REDIRECT /compras");
    expect(rpc).toHaveBeenCalledWith("close_purchase_short", { p_purchase_id: PID, p_note: "No hay más" });
  });

  it("id inválido no llama a la base", async () => {
    const { voidPurchaseReceiptLine } = await import("./purchase-receipts");
    expect(await voidPurchaseReceiptLine("x", "y")).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("updatePurchaseInvoice y voidPurchaseInvoice (S28-03)", () => {
  const base = { purchase_id: PID, invoice_id: IID, number: "FE-128", issued_on: "2026-10-08", subtotal: "7200", tax: "1400" };

  it("corrige la factura sin archivo nuevo (conserva el que tenía)", async () => {
    rpc.mockImplementation(async () => ({ data: null, error: null }));
    const { updatePurchaseInvoice } = await import("./purchase-receipts");
    expect(await updatePurchaseInvoice(null, fd(base))).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("update_purchase_invoice", expect.objectContaining({
      p_invoice_id: IID, p_number: "FE-128", p_total: 8600, p_file_path: null,
    }));
    expect(upload).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith(`/compras/ordenes/${PID}/recibir`);
  });

  it("por debajo de lo pagado se traduce y borra el archivo nuevo", async () => {
    rpc.mockImplementation(async () => ({ data: null, error: { message: "invoice_below_payments" } }));
    const { updatePurchaseInvoice } = await import("./purchase-receipts");
    const file = new File(["%PDF"], "f.pdf", { type: "application/pdf" });
    expect(await updatePurchaseInvoice(null, fd({ ...base, file }))).toEqual({
      ok: false, error: "purchases.receipt.errors.belowPayments",
    });
    expect(remove).toHaveBeenCalled();
  });

  it("anula una factura; con líneas activas se traduce", async () => {
    rpc.mockImplementation(async () => ({ data: null, error: null }));
    const { voidPurchaseInvoice } = await import("./purchase-receipts");
    expect(await voidPurchaseInvoice(PID, IID)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("void_purchase_invoice", { p_invoice_id: IID });

    rpc.mockImplementation(async () => ({ data: null, error: { message: "invoice_has_lines" } }));
    expect(await voidPurchaseInvoice(PID, IID)).toEqual({ ok: false, error: "purchases.receipt.errors.invoiceHasLines" });
  });
});
