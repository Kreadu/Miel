/**
 * S21-05: liquida a un trabajador en un período con el motor que corresponde (mensual para
 * planta/temporal, jornada parcial para por horas). Nunca lanza: un dato inválido (p. ej. días +
 * licencias > 30) vuelve como error legible para mostrarlo en la nómina.
 */
import { ColombiaPayrollEngine } from "./engine/countries/colombiaEngine";
import { PartTimeEmployeeEngine } from "./engine/hourly/partTimeEmployeeEngine";
import {
  buildHourlyInput,
  buildMonthlyInput,
  type Employer,
  isExempt114_1,
  type LeaveRow,
  leavesInPeriod,
} from "./payroll-input";
import type { ColombiaPayrollResult } from "./types/payroll";

export type LiquidationWorker = {
  id: string;
  full_name: string;
  doc_number: string;
  salary: number;
  hourly_rate: number;
  arl_risk_class: number | null;
  worker_type: string;
  hire_date: string | null;
  end_date: string | null;
};

export type SettlementNovelties = {
  days_worked: number;
  extra_diurna: number;
  extra_nocturna: number;
  recargo_nocturno: number;
  horas_dominical_festivo: number;
  hours_worked: number;
  weekly_hours: number;
};

export type Liquidation =
  | {
      ok: true;
      gross_earnings: number;
      total_deductions: number;
      net_pay: number;
      result: ColombiaPayrollResult;
    }
  | { ok: false; error: string };

export function liquidateWorker(
  tenantId: string,
  worker: LiquidationWorker,
  novelties: SettlementNovelties,
  leaves: LeaveRow[],
  period: { start: string; end: string },
  employer: Employer = { personType: "juridica", workerCount: 1 },
): Liquidation {
  try {
    // Salario mensual equivalente del trabajador por horas: 240 h (jornada completa).
    const monthly = worker.worker_type === "por_horas" ? worker.hourly_rate * 240 : worker.salary;
    const exempt = isExempt114_1(employer, monthly);
    const result =
      worker.worker_type === "por_horas"
        ? PartTimeEmployeeEngine.calculate(buildHourlyInput(worker, tenantId, novelties, exempt))
        : ColombiaPayrollEngine.calculate(
            buildMonthlyInput(worker, novelties, leavesInPeriod(leaves, period.start, period.end), exempt),
          );
    return {
      ok: true,
      gross_earnings: result.grossEarnings,
      total_deductions: result.employeeDeductions.totalDeductions,
      net_pay: result.netPay,
      result,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo liquidar." };
  }
}
