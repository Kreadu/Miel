import { describe, expect, it } from "vitest";

import { warehouseSchema } from "./warehouses";

describe("warehouseSchema", () => {
  it("acepta un nombre válido", () => {
    expect(warehouseSchema.safeParse({ name: "Bodega principal" }).success).toBe(true);
  });

  it("recorta espacios al inicio/fin", () => {
    const result = warehouseSchema.safeParse({ name: "  Bodega  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Bodega");
    }
  });

  it("rechaza nombre vacío", () => {
    expect(warehouseSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rechaza nombre de solo espacios", () => {
    expect(warehouseSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rechaza nombre de más de 120 caracteres", () => {
    expect(warehouseSchema.safeParse({ name: "a".repeat(121) }).success).toBe(false);
  });

  it("acepta nombre de exactamente 120 caracteres", () => {
    expect(warehouseSchema.safeParse({ name: "a".repeat(120) }).success).toBe(true);
  });

  it("S19-18: acepta datos de ubicación y contacto; vacíos quedan en null", () => {
    const result = warehouseSchema.safeParse({
      name: "Principal",
      address: " Cra 1 # 2-3 ",
      department: "Antioquia",
      city: "Medellín",
      country: "Colombia",
      postal_code: "050001",
      phone: "",
      whatsapp: "3001234567",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.address).toBe("Cra 1 # 2-3");
      expect(result.data.phone).toBeNull();
      expect(result.data.whatsapp).toBe("3001234567");
    }
  });

  it("S19-18: rechaza un teléfono de más de 30 caracteres", () => {
    expect(warehouseSchema.safeParse({ name: "X", phone: "1".repeat(31) }).success).toBe(false);
  });

  it("S18-10: 'presta stock' es una casilla (marcada = true, ausente = false)", () => {
    expect(warehouseSchema.parse({ name: "X", lends_stock: "on" }).lends_stock).toBe(true);
    expect(warehouseSchema.parse({ name: "X" }).lends_stock).toBe(false);
  });
});
