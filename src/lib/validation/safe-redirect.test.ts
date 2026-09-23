import { describe, expect, it } from "vitest";

import { DEFAULT_AUTHENTICATED_PATH, safeNext } from "./safe-redirect";

describe("safeNext", () => {
  it("acepta rutas relativas internas", () => {
    expect(safeNext("/onboarding")).toBe("/onboarding");
    expect(safeNext("/productos?pagina=2")).toBe("/productos?pagina=2");
  });

  it("descarta URLs absolutas", () => {
    expect(safeNext("https://evil.com")).toBe(DEFAULT_AUTHENTICATED_PATH);
    expect(safeNext("http://evil.com/onboarding")).toBe(DEFAULT_AUTHENTICATED_PATH);
  });

  it("descarta rutas protocol-relative (//externo) y variantes con backslash", () => {
    expect(safeNext("//evil.com")).toBe(DEFAULT_AUTHENTICATED_PATH);
    expect(safeNext("/\\evil.com")).toBe(DEFAULT_AUTHENTICATED_PATH);
  });

  it("descarta esquemas no-http como javascript:", () => {
    expect(safeNext("javascript:alert(1)")).toBe(DEFAULT_AUTHENTICATED_PATH);
    expect(safeNext("data:text/html,hola")).toBe(DEFAULT_AUTHENTICATED_PATH);
  });

  it("cae al default con valores vacíos o no-string", () => {
    expect(safeNext("")).toBe(DEFAULT_AUTHENTICATED_PATH);
    expect(safeNext(null)).toBe(DEFAULT_AUTHENTICATED_PATH);
    expect(safeNext(undefined)).toBe(DEFAULT_AUTHENTICATED_PATH);
  });
});
