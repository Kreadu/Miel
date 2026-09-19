import { describe, expect, it } from "vitest";

import { splitProducts, type ProductOption } from "./product-options";

const products: ProductOption[] = [
  { id: "p1", name: "Producto 1", sku: "SKU-1" },
  { id: "p2", name: "Producto 2", sku: "SKU-2" },
  { id: "p3", name: "Producto 3", sku: "SKU-3" },
];

describe("splitProducts", () => {
  it("sin sugerencias devuelve la lista completa en rest (sin proveedor o sin asociados)", () => {
    const result = splitProducts(products, [], { showAll: false, keepIds: [] });
    expect(result).toEqual({ suggested: [], rest: products });
  });

  it("con sugerencias y showAll=false muestra solo sugeridos + los ya elegidos (keepIds)", () => {
    const result = splitProducts(products, ["p2"], { showAll: false, keepIds: ["p3"] });
    expect(result.suggested.map((p) => p.id)).toEqual(["p2", "p3"]);
    expect(result.rest).toEqual([]);
  });

  it("con showAll=true muestra sugeridos arriba y el resto del catálogo abajo, sin duplicar", () => {
    const result = splitProducts(products, ["p2"], { showAll: true, keepIds: [] });
    expect(result.suggested.map((p) => p.id)).toEqual(["p2"]);
    expect(result.rest.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("no pierde ningún producto del catálogo entre sugeridos y resto", () => {
    const result = splitProducts(products, ["p1", "p3"], { showAll: true, keepIds: [] });
    const allIds = [...result.suggested, ...result.rest].map((p) => p.id).sort();
    expect(allIds).toEqual(["p1", "p2", "p3"]);
  });
});
