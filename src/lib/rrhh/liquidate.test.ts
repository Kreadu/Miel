import { describe, expect, it } from "vitest";

import { liquidateWorker } from "./liquidate";

const period = { start: "2026-09-01", end: "2026-09-30" };
const worker = {
  id: "w-1",
  full_name: "Ana Pérez",
  doc_number: "1010",
  salary: 2_000_000,
  hourly_rate: 0,
  arl_risk_class: 1,
  worker_type: "planta",
  hire_date: null,
  end_date: null,
};
const novelties = {
  days_worked: 30,
  extra_diurna: 0,
  extra_nocturna: 0,
  recargo_nocturno: 0,
  horas_dominical_festivo: 0,
  hours_worked: 0,
  weekly_hours: 0,
};

describe("liquidateWorker (S21-05)", () => {
  it("planta: liquida con el motor mensual", () => {
    const r = liquidateWorker("t-1", worker, novelties, [], period);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.gross_earnings).toBeGreaterThan(2_000_000);
      expect(r.net_pay).toBeLessThan(r.gross_earnings);
      expect(r.total_deductions).toBeCloseTo(r.gross_earnings - r.net_pay, 0);
    }
  });

  it("licencias dentro del período entran al cálculo", () => {
    const r = liquidateWorker(
      "t-1",
      worker,
      { ...novelties, days_worked: 27 },
      [{ type: "GENERAL_INCAPACITY", start_date: "2026-09-10", end_date: "2026-09-12" }],
      period,
    );
    expect(r.ok && r.result.leaveValue).toBeGreaterThan(0);
  });

  it("días + licencias > 30 → error legible, no excepción", () => {
    const r = liquidateWorker(
      "t-1",
      worker,
      novelties,
      [{ type: "GENERAL_INCAPACITY", start_date: "2026-09-10", end_date: "2026-09-12" }],
      period,
    );
    expect(r).toMatchObject({ ok: false });
  });

  it("por horas: liquida con el motor de jornada parcial", () => {
    const r = liquidateWorker(
      "t-1",
      { ...worker, worker_type: "por_horas", salary: 0, hourly_rate: 10_000 },
      { ...novelties, hours_worked: 80, weekly_hours: 20 },
      [],
      period,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.gross_earnings).toBeGreaterThan(0);
  });
});

describe("exoneración 114-1 y redondeo PILA (S23-01)", () => {
  const smmlvWorker = { ...worker, salary: 1_750_905 };
  const contributions = (r: ReturnType<typeof liquidateWorker>) => {
    if (!r.ok) throw new Error(r.error);
    return r.result.employerContributions;
  };

  it("persona jurídica: exonerada de salud 8,5 %, SENA e ICBF (salario < 10 SMMLV)", () => {
    const c = contributions(liquidateWorker("t-1", worker, novelties, [], period, { personType: "juridica", workerCount: 1 }));
    expect(c.health8_5pct).toBe(0);
    expect(c.sena2pct).toBe(0);
    expect(c.icbf3pct).toBe(0);
  });

  it("persona natural con 1 trabajador: no exonerada; con 2 o más sí", () => {
    const one = contributions(liquidateWorker("t-1", worker, novelties, [], period, { personType: "natural", workerCount: 1 }));
    expect(one.health8_5pct).toBe(170_000);
    expect(one.sena2pct).toBe(40_000);
    const two = contributions(liquidateWorker("t-1", worker, novelties, [], period, { personType: "natural", workerCount: 2 }));
    expect(two.health8_5pct).toBe(0);
  });

  it("salario de 10 SMMLV o más: no exonerado", () => {
    const rich = { ...worker, salary: 17_509_050 };
    const c = contributions(liquidateWorker("t-1", rich, novelties, [], period, { personType: "juridica", workerCount: 5 }));
    expect(c.health8_5pct).toBeGreaterThan(0);
  });

  it("cada subsistema se redondea al múltiplo de 100 superior; el trabajador paga su 4 % al peso", () => {
    const r = liquidateWorker("t-1", smmlvWorker, novelties, [], period, { personType: "juridica", workerCount: 1 });
    if (!r.ok) throw new Error(r.error);
    const d = r.result.employeeDeductions;
    const c = r.result.employerContributions;
    expect(d.health4pct).toBe(70_036);
    expect(d.pension4pct).toBe(70_036);
    expect(d.health4pct + c.health8_5pct).toBe(70_100);
    expect(d.pension4pct + c.pension12pct).toBe(280_200);
    expect(c.arlValue).toBe(9_200);
    expect(c.ccf4pct).toBe(70_100);
  });
});
