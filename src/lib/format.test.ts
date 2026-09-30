import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  formatDate,
  formatDateTime,
  formatMoney,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "./format";

describe("formatDate/formatDateTime", () => {
  it("usa la hora de Bogotá, no UTC, para decidir el día", () => {
    // 2026-08-16T02:00:00Z = 15-ago 21:00 hora Bogotá (UTC-5)
    const utcAfterMidnight = "2026-08-16T02:00:00.000Z";
    expect(formatDate(utcAfterMidnight)).toContain("15");
    expect(formatDate(utcAfterMidnight)).not.toContain("16");
    expect(formatDateTime(utcAfterMidnight)).toContain("15");
  });

  it("acepta Date además de string", () => {
    expect(formatDate(new Date("2026-08-15T12:00:00.000Z"))).toContain("15");
  });
});

describe("formatMoney", () => {
  it("formatea con 2 decimales si hay centavos y locale es-CO por defecto", () => {
    expect(formatMoney(1234.5)).toBe("1.234,50");
  });

  it("S23-01: sin centavos no muestra decimales", () => {
    expect(formatMoney(1500000)).toBe("1.500.000");
    expect(formatMoney(1500000.004)).toBe("1.500.000");
  });

  it("no lanza con null/undefined, devuelve 0", () => {
    expect(formatMoney(null)).toBe("0");
    expect(formatMoney(undefined)).toBe("0");
  });

  it("acepta overrides de Intl.NumberFormatOptions", () => {
    expect(
      formatMoney(1234.5, {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    ).toMatch(/^\$\s1\.235$/);
  });
});

describe("toDatetimeLocalValue / fromDatetimeLocalValue", () => {
  it("son inversas para un valor sin milisegundos", () => {
    const iso = "2026-08-15T19:30:00.000Z"; // 14:30 Bogotá
    const local = toDatetimeLocalValue(iso);
    expect(local).toBe("2026-08-15T14:30");
    expect(fromDatetimeLocalValue(local)).toBe(iso);
  });

  it("toDatetimeLocalValue con valor vacío/nulo devuelve string vacío", () => {
    expect(toDatetimeLocalValue(null)).toBe("");
    expect(toDatetimeLocalValue(undefined)).toBe("");
  });

  it("fromDatetimeLocalValue produce un ISO que z.string().datetime() acepta", () => {
    const schema = z.string().datetime();
    const result = fromDatetimeLocalValue("2026-08-15T14:30");
    expect(schema.safeParse(result).success).toBe(true);
  });
});

describe("formatDate con fecha sin hora (S21-05)", () => {
  it("una fecha 'AAAA-MM-DD' es ese día calendario, no el anterior", () => {
    expect(formatDate("2026-09-01")).toBe("1/9/2026");
    expect(formatDate("2026-12-31")).toBe("31/12/2026");
  });
});
