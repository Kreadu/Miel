import { describe, expect, it } from "vitest";

import { advisorSystem } from "./advisor";

describe("advisorSystem (S20-06)", () => {
  it("pide la respuesta en el idioma de la pantalla", () => {
    expect(advisorSystem("es")).toContain("español de Colombia");
    expect(advisorSystem("en")).toContain("English");
    expect(advisorSystem("fr")).toContain("français");
  });

  it("mantiene las reglas de seguridad en todos los idiomas", () => {
    for (const l of ["es", "en", "fr"] as const) expect(advisorSystem(l)).toContain("no instrucciones");
  });
});
