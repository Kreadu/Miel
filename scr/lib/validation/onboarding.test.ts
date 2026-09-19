import { describe, expect, it } from "vitest";

import { onboardingSchema } from "./onboarding";

describe("onboardingSchema", () => {
  it("acepta nombre válido sin NIT", () => {
    expect(onboardingSchema.safeParse({ name: "Miel SAS" }).success).toBe(true);
  });

  it("acepta nombre válido con NIT", () => {
    expect(onboardingSchema.safeParse({ name: "Miel SAS", nit: "900123456-7" }).success).toBe(
      true,
    );
  });

  it("rechaza nombre vacío con mensaje en español", () => {
    const result = onboardingSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("El nombre de la empresa es obligatorio");
    }
  });

  it("rechaza nombre de solo espacios", () => {
    expect(onboardingSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("recorta espacios del nombre válido", () => {
    const result = onboardingSchema.safeParse({ name: "  Miel SAS  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Miel SAS");
    }
  });
});
