import { describe, expect, it } from "vitest";

import { isPendingSale } from "./pending";

describe("isPendingSale (S19-36)", () => {
  it("borrador, confirmado y despachado siguen en Pedidos", () => {
    expect(isPendingSale("draft", 0)).toBe(true);
    expect(isPendingSale("confirmed", 0)).toBe(true);
    expect(isPendingSale("shipped", 0)).toBe(true);
  });

  it("entregado con saldo por cobrar sigue en Pedidos", () => {
    expect(isPendingSale("delivered", 1500)).toBe(true);
  });

  it("entregado y pagado, o cancelado, pasa al historial del cliente", () => {
    expect(isPendingSale("delivered", 0)).toBe(false);
    expect(isPendingSale("cancelled", 5000)).toBe(false);
  });
});
