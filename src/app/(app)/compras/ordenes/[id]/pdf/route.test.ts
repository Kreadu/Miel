// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const ID = "9b8b443a-a9c4-47c9-980f-cd90d14bda41";
const state: { role: string | null; purchase: Record<string, unknown> | null } = { role: "admin", purchase: null };

vi.mock("@/lib/tenant/server", () => ({
  getActiveTenant: vi.fn(async () => ({
    active: state.role ? { tenantId: "t1", role: state.role } : null,
  })),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
const render = vi.fn(async () => Buffer.from("%PDF-1.3 fake"));
vi.mock("@/lib/purchases/purchase-pdf", () => ({ renderPurchasePdf: render }));

function builder(result: () => unknown) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) b[m] = () => b;
  b.maybeSingle = async () => ({ data: result() });
  b.single = async () => ({ data: result() });
  return b;
}
const from = vi.fn((table: string) =>
  builder(() =>
    table === "purchases"
      ? state.purchase
      : { name: "Miel", nit: null, address: null, city: null, phone: null, email: null, logo_url: null },
  ),
);
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ from })) }));

const purchase = {
  number: 3,
  status: "ordered",
  created_at: "2026-10-07T15:00:00Z",
  issued_at: "2026-10-07T16:00:00Z",
  note: null,
  subtotal: 100,
  tax: 0,
  total: 100,
  requested_by_name: "Ana",
  requested_at: "2026-10-07T15:00:00Z",
  approved_by_name: "Ana",
  approved_at: "2026-10-07T15:00:00Z",
  ordered_by_name: "Ana",
  suppliers: { name: "Prov", nit: null, address: null, phone: null, email: null },
  purchase_items: [{ qty: 1, unit_cost: 100, tax_rate: 0, products: { sku: "A", name: "B" } }],
};

async function get(id = ID) {
  const { GET } = await import("./route");
  return GET(new Request("http://localhost"), { params: Promise.resolve({ id }) });
}

describe("GET /compras/ordenes/[id]/pdf (S26-03)", () => {
  beforeEach(() => {
    state.role = "admin";
    state.purchase = purchase;
    render.mockClear();
  });

  it("admin descarga OC-0003.pdf", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="OC-0003.pdf"');
    expect(render).toHaveBeenCalledOnce();
  });

  it.each([
    ["id que no es uuid", () => {}, "x"],
    ["operativo (o modo tienda)", () => (state.role = "member"), ID],
    ["sin empresa activa", () => (state.role = null), ID],
    ["orden inexistente u otra empresa", () => (state.purchase = null), ID],
    ["orden cancelada", () => (state.purchase = { ...purchase, status: "cancelled" }), ID],
  ])("404: %s", async (_name, arrange, id) => {
    arrange();
    const res = await get(id);
    expect(res.status).toBe(404);
    expect(render).not.toHaveBeenCalled();
  });
});
