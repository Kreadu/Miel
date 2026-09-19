import { describe, expect, it } from "vitest";

import { supplierSchema } from "./suppliers";

describe("supplierSchema", () => {
  it("acepta un nombre válido sin campos opcionales", () => {
    expect(supplierSchema.safeParse({ name: "Proveedor Uno" }).success).toBe(true);
  });

  it("recorta espacios al inicio/fin del nombre", () => {
    const result = supplierSchema.safeParse({ name: "  Proveedor  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Proveedor");
    }
  });

  it("rechaza nombre vacío", () => {
    expect(supplierSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rechaza nombre de solo espacios", () => {
    expect(supplierSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rechaza nombre de más de 120 caracteres", () => {
    expect(supplierSchema.safeParse({ name: "a".repeat(121) }).success).toBe(false);
  });

  it("acepta nombre de exactamente 120 caracteres", () => {
    expect(supplierSchema.safeParse({ name: "a".repeat(120) }).success).toBe(true);
  });

  it("acepta nit/email/phone/address válidos", () => {
    const result = supplierSchema.safeParse({
      name: "Proveedor Uno",
      nit: "900111222",
      email: "contacto@proveedor.test",
      phone: "3001234567",
      address: "Calle 1 # 2-3",
    });
    expect(result.success).toBe(true);
  });

  it("acepta nit/email/phone/address vacíos (todos opcionales)", () => {
    const result = supplierSchema.safeParse({
      name: "Proveedor Uno",
      nit: "",
      email: "",
      phone: "",
      address: "",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza email con formato inválido", () => {
    expect(
      supplierSchema.safeParse({ name: "Proveedor Uno", email: "no-es-un-email" }).success,
    ).toBe(false);
  });
});
