import { describe, expect, it } from "vitest";

import { advisorQuestionSchema } from "./advisor";

const base = { question: "¿Cómo subo el margen?", desde: "2026-04", hasta: "2026-09" };

describe("advisorQuestionSchema (S22-03)", () => {
  it("acepta una pregunta con rango válido (recorta espacios)", () => {
    const r = advisorQuestionSchema.safeParse({ ...base, question: "  ¿Cómo subo el margen?  " });
    expect(r.success && r.data.question).toBe("¿Cómo subo el margen?");
  });

  it("rechaza pregunta vacía o de más de 1000 caracteres", () => {
    expect(advisorQuestionSchema.safeParse({ ...base, question: " a " }).success).toBe(false);
    expect(advisorQuestionSchema.safeParse({ ...base, question: "x".repeat(1001) }).success).toBe(false);
  });

  it("rechaza rango invertido, mes inválido o de más de 24 meses", () => {
    expect(advisorQuestionSchema.safeParse({ ...base, desde: "2026-10" }).success).toBe(false);
    expect(advisorQuestionSchema.safeParse({ ...base, desde: "2026-13" }).success).toBe(false);
    expect(advisorQuestionSchema.safeParse({ ...base, desde: "2024-09" }).success).toBe(false);
    expect(advisorQuestionSchema.safeParse({ ...base, desde: "2024-10" }).success).toBe(true);
  });
});
