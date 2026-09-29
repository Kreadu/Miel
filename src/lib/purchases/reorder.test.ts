import { describe, expect, it } from "vitest";

import { parseProductIds, suggestedReorderQty } from "./reorder";

describe("suggestedReorderQty (S19-27)", () => {
  it("repone hasta el doble del mínimo", () => {
    expect(suggestedReorderQty(10, 4)).toBe(16);
    expect(suggestedReorderQty(10, 0)).toBe(20);
  });

  it("con stock negativo o en el mínimo sigue sugiriendo reponer", () => {
    expect(suggestedReorderQty(5, 5)).toBe(5);
    expect(suggestedReorderQty(5, -2)).toBe(12);
  });

  it("nunca sugiere menos de 1", () => {
    expect(suggestedReorderQty(0, 3)).toBe(1);
  });
});

describe("parseProductIds (S19-27)", () => {
  const a = "11111111-1111-4111-8111-111111111111";
  const b = "22222222-2222-4222-8222-222222222222";

  it("lee ids separados por coma, sin repetidos", () => {
    expect(parseProductIds(`${a},${b},${a}`)).toEqual([a, b]);
  });

  it("descarta lo que no es uuid y tolera vacío", () => {
    expect(parseProductIds(`${a},hola,`)).toEqual([a]);
    expect(parseProductIds(undefined)).toEqual([]);
  });
});
