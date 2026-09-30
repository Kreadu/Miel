import { describe, expect, it } from "vitest";

import { NAV_ITEMS, visibleNavItems } from "./nav-visibility";

describe("visibleNavItems", () => {
  it("member no ve los módulos owner/admin-only (Gastos, Equipo)", () => {
    const hrefs = visibleNavItems("member").map((item) => item.href);
    expect(hrefs).not.toContain("/gastos");
    expect(hrefs).not.toContain("/equipo");
  });

  it("owner ve los módulos habilitados, incluido Equipo", () => {
    const hrefs = visibleNavItems("owner").map((item) => item.href);
    expect(hrefs).toContain("/gastos");
    expect(hrefs).toContain("/equipo");
  });

  it("admin ve los módulos habilitados, incluido Equipo", () => {
    const hrefs = visibleNavItems("admin").map((item) => item.href);
    expect(hrefs).toContain("/gastos");
    expect(hrefs).toContain("/equipo");
  });

  it("Finanzas y Producción quedan ocultos del menú para cualquier rol (S14-01)", () => {
    for (const role of ["owner", "admin", "member"] as const) {
      const hrefs = visibleNavItems(role).map((item) => item.href);
      expect(hrefs).not.toContain("/finanzas");
      expect(hrefs).not.toContain("/produccion");
    }
  });

  it("member sí ve los módulos operativos comunes", () => {
    const hrefs = visibleNavItems("member").map((item) => item.href);
    expect(hrefs).toContain("/inicio");
    expect(hrefs).toContain("/inventario");
  });

  it("/dashboard ya no existe en el menú para ningún rol", () => {
    expect(NAV_ITEMS.map((item) => item.href)).not.toContain("/dashboard");
    expect(visibleNavItems("owner").map((item) => item.href)).not.toContain("/dashboard");
    expect(visibleNavItems("member").map((item) => item.href)).not.toContain("/dashboard");
  });

  it("owner ve el orden exacto: Inicio, Vender, Inventario, Comprar, Gastos, RRHH (S19-31)", () => {
    const items = visibleNavItems("owner");
    expect(items.map((item) => item.href)).toEqual([
      "/inicio",
      "/ventas",
      "/inventario",
      "/compras",
      "/gastos",
      "/equipo",
    ]);
    expect(items.map((item) => item.label)).toEqual([
      "Inicio",
      "Vender",
      "Inventario",
      "Comprar",
      "Gastos",
      "RRHH",
    ]);
  });

  it("Ventas y Compras se etiquetan como verbo (Vender/Comprar) sin cambiar el href", () => {
    const items = visibleNavItems("owner");
    expect(items.find((item) => item.href === "/ventas")?.label).toBe("Vender");
    expect(items.find((item) => item.href === "/compras")?.label).toBe("Comprar");
  });

  it("sin divisor huérfano: Producción (dueña del separador) está oculta (S14-01)", () => {
    for (const role of ["owner", "admin", "member"] as const) {
      const items = visibleNavItems(role);
      const withSeparator = items.filter((item) => item.separatorBefore);
      expect(withSeparator).toHaveLength(0);
    }
  });

  it("S21-03: con categoría solo aparecen sus módulos (e Inicio)", () => {
    const hrefs = visibleNavItems("member", ["ventas", "inventario"]).map((item) => item.href);
    expect(hrefs).toEqual(["/inicio", "/ventas", "/inventario"]);
    expect(visibleNavItems("member", []).map((item) => item.href)).toEqual(["/inicio"]);
  });
});
