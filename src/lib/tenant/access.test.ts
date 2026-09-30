import { describe, expect, it } from "vitest";

import { canSeeHref, resolveAccess } from "./access";

describe("resolveAccess (S21-03)", () => {
  it("dueño y admin ven todo", () => {
    expect(resolveAccess("owner", null, null)).toMatchObject({ modules: null, role: "owner", needsWorker: false });
    expect(resolveAccess("admin", ["ventas"], null).modules).toBeNull();
  });

  it("operativo con categoría ve sus módulos; sin categoría, lo de siempre", () => {
    expect(resolveAccess("member", ["ventas", "inventario"], null).modules).toEqual(["ventas", "inventario"]);
    expect(resolveAccess("member", null, null).modules).toBeNull();
  });

  it("modo tienda sin trabajador identificado: nada, y pide el código", () => {
    expect(resolveAccess("member", null, { worker: null })).toMatchObject({
      modules: [],
      role: "member",
      storeMode: true,
      needsWorker: true,
    });
  });

  it("modo tienda con trabajador: sus módulos y rol operativo", () => {
    const access = resolveAccess("member", null, {
      worker: { id: "w-1", name: "Ana", modules: ["ventas"] },
    });
    expect(access).toMatchObject({ modules: ["ventas"], role: "member", needsWorker: false });
    expect(access.worker?.name).toBe("Ana");
  });
});

describe("canSeeHref (S21-03)", () => {
  it("Inicio siempre; cada módulo según la lista; sin lista, todo", () => {
    expect(canSeeHref("/inicio", ["ventas"])).toBe(true);
    expect(canSeeHref("/ventas/pedidos", ["ventas"])).toBe(true);
    expect(canSeeHref("/inventario", ["ventas"])).toBe(false);
    expect(canSeeHref("/equipo/nomina", ["rrhh"])).toBe(true);
    expect(canSeeHref("/compras", null)).toBe(true);
  });
});
