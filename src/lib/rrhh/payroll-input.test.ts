import { describe, expect, it } from "vitest";

import { ColombiaPayrollEngine } from "./engine/countries/colombiaEngine";
import {
  buildMonthlyInput,
  defaultDaysWorked,
  dianEmployeeExtra,
  leavesInPeriod,
  splitName,
} from "./payroll-input";
import { RiskClass } from "./types/payroll";

const period = { start: "2026-09-01", end: "2026-09-30" };

describe("leavesInPeriod (S21-05)", () => {
  it("cuenta solo los días dentro del período y los días previos de incapacidad general", () => {
    const leaves = leavesInPeriod(
      [
        { type: "GENERAL_INCAPACITY", start_date: "2026-08-28", end_date: "2026-09-03" },
        { type: "MATERNITY_LEAVE", start_date: "2026-09-20", end_date: "2026-12-10" },
        { type: "WORK_INCAPACITY", start_date: "2026-07-01", end_date: "2026-07-05" },
      ],
      period.start,
      period.end,
    );
    expect(leaves).toEqual([
      { type: "GENERAL_INCAPACITY", daysInPeriod: 3, accumulatedDaysBefore: 4 },
      { type: "MATERNITY_LEAVE", daysInPeriod: 11 },
    ]);
  });
});

describe("defaultDaysWorked (S21-05)", () => {
  it("mes completo menos días de licencia, máximo 30", () => {
    expect(defaultDaysWorked(period.start, period.end, null, null, 0)).toBe(30);
    expect(defaultDaysWorked(period.start, period.end, null, null, 3)).toBe(27);
    expect(defaultDaysWorked("2026-08-01", "2026-08-31", null, null, 0)).toBe(30);
  });

  it("ingreso o término dentro del período", () => {
    expect(defaultDaysWorked(period.start, period.end, "2026-09-16", null, 0)).toBe(15);
    expect(defaultDaysWorked(period.start, period.end, null, "2026-09-10", 0)).toBe(10);
  });

  it("sin días en el período → 0 (no se liquida)", () => {
    expect(defaultDaysWorked(period.start, period.end, "2026-10-01", null, 0)).toBe(0);
  });
});

describe("splitName (S21-05)", () => {
  it("separa nombres y apellidos para la DIAN", () => {
    expect(splitName("Ana")).toEqual({ firstName: "Ana", lastName: "Ana" });
    expect(splitName("Ana Pérez")).toEqual({ firstName: "Ana", lastName: "Pérez" });
    expect(splitName("Ana María Pérez Gómez")).toEqual({
      firstName: "Ana",
      firstName2: "María",
      lastName: "Pérez",
      lastName2: "Gómez",
    });
  });
});

describe("buildMonthlyInput (S21-05)", () => {
  it("arma la entrada del motor y el motor liquida", () => {
    const input = buildMonthlyInput(
      {
        id: "w-1",
        full_name: "Ana Pérez",
        doc_number: "1010",
        salary: 2_000_000,
        arl_risk_class: 1,
      },
      { days_worked: 30, extra_diurna: 2, extra_nocturna: 0, recargo_nocturno: 0, horas_dominical_festivo: 0 },
      [],
      false,
    );
    expect(input).toMatchObject({
      employeeId: "w-1",
      firstName: "Ana",
      lastName: "Pérez",
      taxId: "1010",
      baseSalaryMonthly: 2_000_000,
      daysWorked: 30,
      extraDiurna: 2,
      riskClass: RiskClass.CLASS_I,
    });
    const result = ColombiaPayrollEngine.calculate(input);
    expect(result.netPay).toBeGreaterThan(0);
    expect(result.grossEarnings).toBeGreaterThan(2_000_000);
  });
});

describe("dianEmployeeExtra (S21-05)", () => {
  it("traduce documento y contrato a los códigos DIAN", () => {
    expect(dianEmployeeExtra({ doc_type: "cc", contract_type: "indefinido" })).toEqual({
      ok: true,
      extra: { typeDocument: "13", typeContract: "2", paymentMethod: "42" },
    });
    expect(dianEmployeeExtra({ doc_type: "ce", contract_type: "fijo" })).toMatchObject({
      ok: true,
      extra: { typeDocument: "22", typeContract: "1" },
    });
  });

  it("prestación de servicios no es nómina electrónica", () => {
    expect(dianEmployeeExtra({ doc_type: "cc", contract_type: "prestacion_servicios" }).ok).toBe(false);
  });
});
