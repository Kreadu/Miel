import { describe, expect, it } from "vitest";

import { COUNTRY_CODES, internationalPhone } from "./phone";

describe("internationalPhone (S27-10)", () => {
  it("código de país + solo los dígitos del número", () => {
    expect(internationalPhone("+57", "310 555-0001")).toBe("+57 3105550001");
    expect(internationalPhone("+1", "(305) 555 0000")).toBe("+1 3055550000");
  });

  it("Colombia va primero y no hay códigos repetidos por país", () => {
    expect(COUNTRY_CODES[0]).toMatchObject({ iso: "CO", dial: "+57" });
    expect(new Set(COUNTRY_CODES.map((c) => c.iso)).size).toBe(COUNTRY_CODES.length);
  });
});
