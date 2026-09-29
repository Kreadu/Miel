import { describe, expect, it } from "vitest";

import { onboardingSchema } from "./onboarding";

const base = { name: "Miel SAS", sellsPhysical: true, sellsVirtual: false };

describe("onboardingSchema", () => {
  it("acepta nombre válido sin NIT, canal físico", () => {
    expect(onboardingSchema.safeParse(base).success).toBe(true);
  });

  it("acepta nombre válido con NIT", () => {
    expect(onboardingSchema.safeParse({ ...base, nit: "900123456-7" }).success).toBe(true);
  });

  it("rechaza nombre vacío con mensaje en español", () => {
    const result = onboardingSchema.safeParse({ ...base, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("El nombre de la empresa es obligatorio");
    }
  });

  it("rechaza nombre de solo espacios", () => {
    expect(onboardingSchema.safeParse({ ...base, name: "   " }).success).toBe(false);
  });

  it("recorta espacios del nombre válido", () => {
    const result = onboardingSchema.safeParse({ ...base, name: "  Miel SAS  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Miel SAS");
    }
  });

  it("acepta solo canal virtual", () => {
    expect(
      onboardingSchema.safeParse({ ...base, sellsPhysical: false, sellsVirtual: true }).success,
    ).toBe(true);
  });

  it("acepta ambos canales", () => {
    expect(
      onboardingSchema.safeParse({ ...base, sellsPhysical: true, sellsVirtual: true }).success,
    ).toBe(true);
  });

  it("rechaza cuando ningún canal está marcado", () => {
    const result = onboardingSchema.safeParse({
      ...base,
      sellsPhysical: false,
      sellsVirtual: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Elige al menos un canal de venta: local físico o catálogo online",
      );
    }
  });
});
