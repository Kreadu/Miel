// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const store: { current: unknown } = { current: null };
vi.mock("@/lib/store/load", () => ({ loadStore: vi.fn(async () => store.current) }));

async function get(slug = "dulce-miel") {
  const { GET } = await import("./route");
  return GET(new Request("http://localhost"), { params: Promise.resolve({ slug }) });
}

describe("manifest de la tienda (S27-01)", () => {
  it("nombre, color e ícono de la empresa, sin Miel", async () => {
    store.current = { info: { name: "Dulce Miel SAS", store_color: "#A0522D" }, products: [] };
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/manifest+json");
    const body = await res.json();
    expect(body).toMatchObject({
      name: "Dulce Miel SAS",
      short_name: "Dulce Miel SAS",
      start_url: "/tienda/dulce-miel",
      scope: "/tienda/dulce-miel",
      display: "standalone",
      theme_color: "#A0522D",
      icons: [{ src: "/tienda/dulce-miel/app-icon", sizes: "512x512", type: "image/png" }],
    });
    // La marca de la plataforma no aparece (el nombre de esta empresa sí contiene "Miel").
    expect(JSON.stringify({ ...body, name: "", short_name: "" })).not.toMatch(/miel erp|gestión empresarial/i);
  });

  it("404 si la tienda no existe o está apagada", async () => {
    store.current = null;
    expect((await get()).status).toBe(404);
  });
});
