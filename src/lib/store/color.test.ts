import { describe, expect, it } from "vitest";

import { DEFAULT_STORE_COLOR, readableOn, storeColor } from "./color";

describe("storeColor (S27-01)", () => {
  it("usa el color válido de la empresa y si no, uno neutro", () => {
    expect(storeColor("#A0522D")).toBe("#A0522D");
    expect(storeColor(null)).toBe(DEFAULT_STORE_COLOR);
    expect(storeColor("red;}body{")).toBe(DEFAULT_STORE_COLOR);
  });
});

describe("readableOn (S27-01)", () => {
  it("texto blanco sobre colores oscuros y negro sobre claros", () => {
    expect(readableOn("#1f2937")).toBe("#ffffff");
    expect(readableOn("#fdb409")).toBe("#000000");
    expect(readableOn("#ffffff")).toBe("#000000");
  });
});
