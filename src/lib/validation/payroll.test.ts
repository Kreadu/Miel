import { describe, expect, it } from "vitest";

import { dianSettingsSchema, leaveSchema, noveltiesSchema, periodSchema } from "./payroll";

const W = "11111111-1111-4111-8111-111111111111";

describe("leaveSchema (S21-05)", () => {
  it("acepta una licencia válida y rechaza fin antes del inicio o tipo desconocido", () => {
    const ok = { worker_id: W, type: "MATERNITY_LEAVE", start_date: "2026-09-01", end_date: "2026-12-07" };
    expect(leaveSchema.safeParse(ok).success).toBe(true);
    expect(leaveSchema.safeParse({ ...ok, end_date: "2026-08-01" }).success).toBe(false);
    expect(leaveSchema.safeParse({ ...ok, type: "VACACIONES" }).success).toBe(false);
  });
});

describe("periodSchema (S21-05)", () => {
  it("acepta un mes y rechaza rango invertido", () => {
    expect(periodSchema.safeParse({ period_start: "2026-09-01", period_end: "2026-09-30" }).success).toBe(true);
    expect(periodSchema.safeParse({ period_start: "2026-09-30", period_end: "2026-09-01" }).success).toBe(false);
  });
});

describe("noveltiesSchema (S21-05)", () => {
  it("coacciona números y limita días a 30", () => {
    const r = noveltiesSchema.safeParse({ days_worked: "28", extra_diurna: "2" });
    expect(r.success && r.data.days_worked).toBe(28);
    expect(r.success && r.data.extra_nocturna).toBe(0);
    expect(noveltiesSchema.safeParse({ days_worked: "31" }).success).toBe(false);
    expect(noveltiesSchema.safeParse({ days_worked: "10", extra_diurna: "-1" }).success).toBe(false);
  });
});

describe("dianSettingsSchema (S21-05)", () => {
  it("exige NIT, DV de un dígito, razón social, software y PIN", () => {
    const ok = { nit: "900123456", dv: "7", company_name: "Miel SAS", software_id: "abc", software_pin: "12345" };
    expect(dianSettingsSchema.safeParse(ok).success).toBe(true);
    expect(dianSettingsSchema.safeParse({ ...ok, dv: "77" }).success).toBe(false);
    expect(dianSettingsSchema.safeParse({ ...ok, nit: "9001-23" }).success).toBe(false);
  });
});
