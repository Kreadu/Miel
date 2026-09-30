/**
 * S21-05: puente entre los datos de Miel (trabajadores, licencias, novedades) y el motor de
 * nómina copiado de Gestion-Future (ADR-036). Solo funciones puras: el servidor las usa para
 * liquidar y la BD guarda el resultado.
 */
import { CONSTANTS_2026 } from "./engine/countries/constants2026";
import { daysInclusive, intersectDateRanges } from "./services/dateRanges";
import type { PartTimeEmployeeInput } from "./types/hourly";
import {
  type ColombiaPayrollInput,
  type DianEmployeeExtraInfo,
  type EmployeeLeaveInput,
  type EmployeeLeaveType,
  RiskClass,
} from "./types/payroll";

export type LeaveRow = { type: string; start_date: string; end_date: string };

/** Día anterior a una fecha ISO. */
function dayBefore(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Licencias que caen en el período, con los días dentro y (incapacidad general) los previos. */
export function leavesInPeriod(leaves: LeaveRow[], periodStart: string, periodEnd: string): EmployeeLeaveInput[] {
  const result: EmployeeLeaveInput[] = [];
  for (const leave of leaves) {
    const overlap = intersectDateRanges(leave.start_date, leave.end_date, periodStart, periodEnd);
    if (!overlap) continue;
    const type = leave.type as EmployeeLeaveType;
    const input: EmployeeLeaveInput = { type, daysInPeriod: overlap.days };
    if (type === "GENERAL_INCAPACITY" && leave.start_date < periodStart) {
      input.accumulatedDaysBefore = daysInclusive(leave.start_date, dayBefore(periodStart));
    }
    result.push(input);
  }
  return result;
}

/**
 * Días normales trabajados por defecto: días del período dentro del contrato (ingreso/término),
 * máximo 30 (mes comercial), menos los días de licencia. 0 = no se liquida en este período.
 */
export function defaultDaysWorked(
  periodStart: string,
  periodEnd: string,
  hireDate: string | null,
  endDate: string | null,
  leaveDays: number,
): number {
  const overlap = intersectDateRanges(hireDate ?? periodStart, endDate ?? periodEnd, periodStart, periodEnd);
  if (!overlap) return 0;
  const fullPeriod = overlap.start === periodStart && overlap.end === periodEnd;
  const days = fullPeriod ? 30 : Math.min(overlap.days, 30);
  return Math.max(days - leaveDays, 0);
}

/** "Ana María Pérez Gómez" → nombres y apellidos como los pide la DIAN. */
export function splitName(fullName: string): {
  firstName: string;
  firstName2?: string;
  lastName: string;
  lastName2?: string;
} {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
  if (parts.length === 3) return { firstName: parts[0], lastName: parts[1], lastName2: parts[2] };
  return {
    firstName: parts[0],
    firstName2: parts.slice(1, -2).join(" "),
    lastName: parts[parts.length - 2],
    lastName2: parts[parts.length - 1],
  };
}

const RISK_CLASSES = [RiskClass.CLASS_I, RiskClass.CLASS_II, RiskClass.CLASS_III, RiskClass.CLASS_IV, RiskClass.CLASS_V];

export function riskClassFor(n: number | null): RiskClass {
  return RISK_CLASSES[(n ?? 1) - 1] ?? RiskClass.CLASS_I;
}

/** S23-01: quién paga la nómina (datos fiscales de la empresa). */
export type Employer = { personType: "juridica" | "natural"; workerCount: number };

/**
 * S23-01: exoneración de aportes (salud 8,5 %, SENA, ICBF, art. 114-1 E.T.): trabajadores que
 * ganan menos de 10 SMMLV, si el empleador es persona jurídica o persona natural con 2 o más
 * trabajadores.
 */
export function isExempt114_1(employer: Employer, monthlySalary: number): boolean {
  return (
    monthlySalary < 10 * CONSTANTS_2026.SMMLV && (employer.personType === "juridica" || employer.workerCount >= 2)
  );
}

export type PayrollWorker = {
  id: string;
  full_name: string;
  doc_number: string;
  salary: number;
  arl_risk_class: number | null;
};

export type Novelties = {
  days_worked: number;
  extra_diurna: number;
  extra_nocturna: number;
  recargo_nocturno: number;
  horas_dominical_festivo: number;
};

/** Trabajador de planta o temporal (salario mensual) → entrada de ColombiaPayrollEngine. */
export function buildMonthlyInput(
  worker: PayrollWorker,
  novelties: Novelties,
  leaves: EmployeeLeaveInput[],
  exempt: boolean,
): ColombiaPayrollInput {
  return {
    employeeId: worker.id,
    ...splitName(worker.full_name),
    taxId: worker.doc_number,
    baseSalaryMonthly: worker.salary,
    daysWorked: novelties.days_worked,
    riskClass: riskClassFor(worker.arl_risk_class),
    isExempt114_1: exempt,
    extraDiurna: novelties.extra_diurna,
    extraNocturna: novelties.extra_nocturna,
    recargoNocturno: novelties.recargo_nocturno,
    horasDominicalFestivo: novelties.horas_dominical_festivo,
    leaves,
  };
}

/** Trabajador por horas → entrada de PartTimeEmployeeEngine. */
export function buildHourlyInput(
  worker: PayrollWorker & { hourly_rate: number },
  tenantId: string,
  hours: { hours_worked: number; weekly_hours: number },
  exempt: boolean,
): PartTimeEmployeeInput {
  return {
    companyId: tenantId,
    engagementId: worker.id,
    professionalId: worker.id,
    ...splitName(worker.full_name),
    taxId: worker.doc_number,
    hourlyRate: worker.hourly_rate,
    weeklyHours: hours.weekly_hours,
    hoursWorked: hours.hours_worked,
    riskClass: riskClassFor(worker.arl_risk_class),
    isExempt114_1: exempt,
  };
}

const DIAN_DOC: Record<string, DianEmployeeExtraInfo["typeDocument"]> = {
  cc: "13",
  ce: "22",
  pasaporte: "41",
  ppt: "42",
};
const DIAN_CONTRACT: Record<string, DianEmployeeExtraInfo["typeContract"]> = {
  fijo: "1",
  indefinido: "2",
  obra_labor: "3",
  aprendizaje: "4",
};

/** Documento y contrato del trabajador en los códigos de la nómina electrónica DIAN. */
export function dianEmployeeExtra(worker: {
  doc_type: string;
  contract_type: string;
}): { ok: true; extra: DianEmployeeExtraInfo } | { ok: false; error: string } {
  const typeDocument = DIAN_DOC[worker.doc_type];
  if (!typeDocument) return { ok: false, error: "Ese tipo de documento no se admite en la nómina electrónica." };
  const typeContract = DIAN_CONTRACT[worker.contract_type];
  if (!typeContract) {
    return { ok: false, error: "Prestación de servicios no lleva nómina electrónica (va con documento soporte)." };
  }
  return { ok: true, extra: { typeDocument, typeContract, paymentMethod: "42" } };
}
