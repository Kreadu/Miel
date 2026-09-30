import { describe, expect, it } from "vitest";

import { workerCategorySchema, workerPositionSchema, workerSchema } from "./workers";

describe("workerCategorySchema (S21-02)", () => {
  it("acepta nombre y módulos válidos", () => {
    const r = workerCategorySchema.safeParse({ name: "Vendedor", modules: ["ventas", "inventario"] });
    expect(r.success).toBe(true);
  });

  it("rechaza módulos desconocidos y nombre vacío", () => {
    expect(workerCategorySchema.safeParse({ name: "X", modules: ["finanzas"] }).success).toBe(false);
    expect(workerCategorySchema.safeParse({ name: " ", modules: [] }).success).toBe(false);
  });
});

describe("workerSchema (S21-02)", () => {
  const base = { full_name: "Ana Pérez", doc_type: "cc", doc_number: "1010", salary: "1423500" };

  it("acepta un trabajador mínimo con defaults", () => {
    const r = workerSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.contract_type).toBe("indefinido");
      expect(r.data.work_schedule).toBe("completa");
      expect(r.data.salary).toBe(1423500);
      expect(r.data.eps).toBeNull();
    }
  });

  it("rechaza salario negativo, clase de riesgo fuera de 1-5 y correo inválido", () => {
    expect(workerSchema.safeParse({ ...base, salary: "-1" }).success).toBe(false);
    expect(workerSchema.safeParse({ ...base, arl_risk_class: "6" }).success).toBe(false);
    expect(workerSchema.safeParse({ ...base, email: "no-es-correo" }).success).toBe(false);
  });

  it("clase de riesgo y fecha opcionales; vacíos → null", () => {
    const r = workerSchema.safeParse({ ...base, arl_risk_class: "", hire_date: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.arl_risk_class).toBeNull();
      expect(r.data.hire_date).toBeNull();
    }
  });

  it("S21-02c: tipo de trabajador, valor hora, fecha de término y contacto de urgencia", () => {
    const r = workerSchema.safeParse({
      ...base,
      worker_type: "por_horas",
      hourly_rate: "9000",
      end_date: "2026-12-31",
      emergency_contact_name: " Rosa ",
      emergency_phone: "3001234567",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.worker_type).toBe("por_horas");
      expect(r.data.hourly_rate).toBe(9000);
      expect(r.data.end_date).toBe("2026-12-31");
      expect(r.data.emergency_contact_name).toBe("Rosa");
    }
    const def = workerSchema.safeParse(base);
    expect(def.success && def.data.worker_type).toBe("planta");
    expect(workerSchema.safeParse({ ...base, worker_type: "freelance" }).success).toBe(false);
    expect(workerSchema.safeParse({ ...base, hourly_rate: "-1" }).success).toBe(false);
  });
});

describe("workerPositionSchema (S21-02c)", () => {
  it("acepta un cargo y rechaza vacío", () => {
    expect(workerPositionSchema.safeParse({ name: "Cajero" }).success).toBe(true);
    expect(workerPositionSchema.safeParse({ name: " " }).success).toBe(false);
  });
});

