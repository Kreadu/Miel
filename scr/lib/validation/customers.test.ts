import { describe, expect, it } from "vitest";

import { customerSchema } from "./customers";

describe("customerSchema", () => {
  it("acepta un cliente válido mínimo (solo nombre y doc_type)", () => {
    const res = customerSchema.safeParse({ name: "Cliente 1", doc_type: "cc" });
    expect(res.success).toBe(true);
  });

  it("acepta un cliente válido completo", () => {
    const res = customerSchema.safeParse({
      name: "Juan Perez",
      doc_type: "nit",
      doc_number: "900123456",
      email: "juan@test.com",
      phone: "3001234567",
      address: "Calle Falsa 123",
      note: "Cliente VIP",
    });
    expect(res.success).toBe(true);
  });

  it("rechaza nombre vacío", () => {
    const res = customerSchema.safeParse({ name: "   ", doc_type: "nit" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe("El nombre es obligatorio");
    }
  });

  it("rechaza doc_type inválido", () => {
    const res = customerSchema.safeParse({ name: "Juan", doc_type: "pasaporte" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe("Tipo de documento inválido");
    }
  });

  it("rechaza email inválido", () => {
    const res = customerSchema.safeParse({ name: "Juan", doc_type: "cc", email: "no-soy-un-correo" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe("Email inválido");
    }
  });

  it("convierte strings vacíos en campos opcionales", () => {
    const res = customerSchema.safeParse({
      name: "Juan",
      doc_type: "cc",
      doc_number: "",
      email: "",
      phone: "",
      address: "",
      note: "",
    });
    expect(res.success).toBe(true);
  });
});
