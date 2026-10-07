import { describe, expect, it } from "vitest";

import { waPhone, whatsappUrl } from "./whatsapp";

describe("waPhone (S26-03)", () => {
  it("celular colombiano de 10 dígitos gana el 57", () => {
    expect(waPhone("300 123 4567")).toBe("573001234567");
  });
  it("deja solo dígitos de un número con indicativo", () => {
    expect(waPhone("+57 (300) 123-4567")).toBe("573001234567");
  });
  it("no toca un fijo ni un número extranjero", () => {
    expect(waPhone("6012345678")).toBe("6012345678");
    expect(waPhone("+1 415 555 0100")).toBe("14155550100");
  });
  it("sin teléfono → null", () => {
    expect(waPhone(null)).toBeNull();
    expect(waPhone("  -  ")).toBeNull();
  });
});

describe("whatsappUrl (S26-03)", () => {
  it("abre el chat del proveedor con el mensaje codificado", () => {
    expect(whatsappUrl("3001234567", "OC-0001 & total $1.000")).toBe(
      "https://wa.me/573001234567?text=OC-0001%20%26%20total%20%241.000",
    );
  });
  it("sin teléfono abre WhatsApp sin destinatario", () => {
    expect(whatsappUrl(null, "hola")).toBe("https://wa.me/?text=hola");
  });
});
