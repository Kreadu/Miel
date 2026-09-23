import { describe, expect, it } from "vitest";

import { interactionSchema } from "./interactions";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";

describe("interactionSchema", () => {
  it("acepta una interacción válida mínima", () => {
    const res = interactionSchema.safeParse({
      customer_id: CUSTOMER_ID,
      kind: "note",
      note: "Cliente pidió cotización de miel de multiflora",
    });
    expect(res.success).toBe(true);
  });

  it("acepta una interacción válida con occurred_at", () => {
    const res = interactionSchema.safeParse({
      customer_id: CUSTOMER_ID,
      kind: "followup",
      note: "Llamada de seguimiento",
      occurred_at: "2026-07-20T10:00",
    });
    expect(res.success).toBe(true);
  });

  it("rechaza customer_id inválido", () => {
    const res = interactionSchema.safeParse({
      customer_id: "no-es-un-uuid",
      kind: "note",
      note: "algo",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe("Cliente inválido");
    }
  });

  it("rechaza kind fuera del dominio cerrado", () => {
    const res = interactionSchema.safeParse({
      customer_id: CUSTOMER_ID,
      kind: "urgent",
      note: "algo",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe("Tipo de interacción inválido");
    }
  });

  it("rechaza note vacía", () => {
    const res = interactionSchema.safeParse({
      customer_id: CUSTOMER_ID,
      kind: "complaint",
      note: "   ",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe("La nota es obligatoria");
    }
  });
});
