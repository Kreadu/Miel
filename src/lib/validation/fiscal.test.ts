import { describe, expect, it } from "vitest";

import { fiscalSettingsSchema } from "./fiscal";

describe("fiscalSettingsSchema (S23-01)", () => {
  it("acepta jurídica 35 % (texto del formulario)", () => {
    const r = fiscalSettingsSchema.safeParse({ person_type: "juridica", income_tax_rate: "35" });
    expect(r.success && r.data.income_tax_rate).toBe(35);
  });

  it("rechaza tipo desconocido y tarifa fuera de 0–100", () => {
    expect(fiscalSettingsSchema.safeParse({ person_type: "otra", income_tax_rate: "35" }).success).toBe(false);
    expect(fiscalSettingsSchema.safeParse({ person_type: "natural", income_tax_rate: "-1" }).success).toBe(false);
    expect(fiscalSettingsSchema.safeParse({ person_type: "natural", income_tax_rate: "101" }).success).toBe(false);
  });
});
