import { describe, expect, it } from "vitest";

import { isValidStoreSlug, normalizeStoreSlug } from "./slug";

describe("normalizeStoreSlug (S27-01)", () => {
  it("minúsculas, sin tildes, espacios y símbolos a guiones", () => {
    expect(normalizeStoreSlug("  Dulce Miel ")).toBe("dulce-miel");
    expect(normalizeStoreSlug("Panadería Ñoño & Cía.")).toBe("panaderia-nono-cia");
  });
  it("sin guiones repetidos ni en los bordes", () => {
    expect(normalizeStoreSlug("--a  --  b--")).toBe("a-b");
  });
});

describe("isValidStoreSlug (S27-01)", () => {
  it("acepta 3 a 40 caracteres válidos", () => {
    expect(isValidStoreSlug("abc")).toBe(true);
    expect(isValidStoreSlug("dulce-miel-2")).toBe(true);
    expect(isValidStoreSlug("a".repeat(40))).toBe(true);
  });
  it("rechaza corto, largo, formato y reservadas", () => {
    expect(isValidStoreSlug("ab")).toBe(false);
    expect(isValidStoreSlug("a".repeat(41))).toBe(false);
    expect(isValidStoreSlug("-abc")).toBe(false);
    expect(isValidStoreSlug("Abc")).toBe(false);
    expect(isValidStoreSlug("admin")).toBe(false);
    expect(isValidStoreSlug("miel")).toBe(false);
  });
});
