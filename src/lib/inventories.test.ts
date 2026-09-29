import { describe, expect, it } from "vitest";

import { INVENTORIES, inventoryBySlug, resolveKind } from "./inventories";

describe("inventarios (S19-26)", () => {
  it("el primero es el de productos para vender", () => {
    expect(INVENTORIES[0].id).toBe("productos");
    expect(INVENTORIES.filter((i) => i.sellable).map((i) => i.id)).toEqual(["productos"]);
  });

  it("busca por slug de URL", () => {
    expect(inventoryBySlug("materias-primas")?.id).toBe("materias_primas");
    expect(inventoryBySlug("no-existe")).toBeUndefined();
  });

  it("el inventario fija el tipo", () => {
    expect(resolveKind("productos", "finished")).toBe("finished");
    expect(resolveKind("productos", "raw")).toBe("resale");
    expect(resolveKind("materias_primas", "resale")).toBe("raw");
    expect(resolveKind("vehiculos", "finished")).toBe("other");
  });

  it("vehículos tienen placa; mobiliario tiene marca y serie sin placa", () => {
    const v = INVENTORIES.find((i) => i.id === "vehiculos")!;
    const m = INVENTORIES.find((i) => i.id === "mobiliario")!;
    expect(v.assetFields).toContain("plate");
    expect(m.assetFields).toEqual(expect.arrayContaining(["brand", "serial_number"]));
    expect(m.assetFields).not.toContain("plate");
  });
});
