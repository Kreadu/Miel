import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import es from "../../messages/es.json";
import fr from "../../messages/fr.json";

/** E20 (ADR-040): los tres idiomas tienen exactamente las mismas claves y ningún texto vacío. */
function flatten(obj: object, prefix = ""): Record<string, unknown> {
  return Object.entries(obj).reduce<Record<string, unknown>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" ? { ...acc, ...flatten(v, key) } : { ...acc, [key]: v };
  }, {});
}

const locales = { es: flatten(es), en: flatten(en), fr: flatten(fr) };

describe("mensajes por idioma (E20)", () => {
  it("inglés y francés tienen las mismas claves que español", () => {
    const keys = Object.keys(locales.es).sort();
    expect(Object.keys(locales.en).sort()).toEqual(keys);
    expect(Object.keys(locales.fr).sort()).toEqual(keys);
  });

  it("ningún texto vacío", () => {
    for (const [locale, messages] of Object.entries(locales)) {
      for (const [key, value] of Object.entries(messages)) {
        expect(typeof value === "string" && value.trim().length > 0, `${locale}:${key}`).toBe(true);
      }
    }
  });
});
