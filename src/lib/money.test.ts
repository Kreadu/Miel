import { describe, expect, it } from "vitest";

import { round2 } from "./money";

describe("round2 (S23-01)", () => {
  it("redondea medio centavo hacia arriba como Postgres", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-1.005)).toBe(-1.01);
  });

  it("deja igual lo que ya tiene 2 decimales", () => {
    expect(round2(154.7)).toBe(154.7);
    expect(round2(0)).toBe(0);
  });
});
