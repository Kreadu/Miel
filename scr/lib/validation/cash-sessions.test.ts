import { describe, expect, it } from "vitest";

import { closeCashSessionSchema, openCashSessionSchema } from "./cash-sessions";

describe("openCashSessionSchema", () => {
  it("acepta un monto base válido", () => {
    expect(openCashSessionSchema.safeParse({ opening_amount: 500 }).success).toBe(true);
  });

  it("acepta cero", () => {
    expect(openCashSessionSchema.safeParse({ opening_amount: 0 }).success).toBe(true);
  });

  it("rechaza montos negativos", () => {
    expect(openCashSessionSchema.safeParse({ opening_amount: -1 }).success).toBe(false);
  });

  it("coerciona string a number", () => {
    const result = openCashSessionSchema.safeParse({ opening_amount: "500" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.opening_amount).toBe(500);
  });
});

describe("closeCashSessionSchema", () => {
  it("acepta un monto contado válido sin session_id", () => {
    expect(closeCashSessionSchema.safeParse({ counted_amount: 600 }).success).toBe(true);
  });

  it("acepta un session_id válido y una nota opcional", () => {
    const result = closeCashSessionSchema.safeParse({
      counted_amount: 600,
      session_id: "11111111-1111-4111-8111-111111111111",
      note: "turno de la tarde",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza montos negativos", () => {
    expect(closeCashSessionSchema.safeParse({ counted_amount: -1 }).success).toBe(false);
  });

  it("rechaza session_id inválido", () => {
    expect(closeCashSessionSchema.safeParse({ counted_amount: 600, session_id: "no-es-uuid" }).success).toBe(false);
  });
});
