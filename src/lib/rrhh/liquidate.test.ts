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
