import { z } from "zod";

export const LEAVE_TYPE_IDS = ["GENERAL_INCAPACITY", "WORK_INCAPACITY", "MATERNITY_LEAVE", "PATERNITY_LEAVE"] as const;
const isoDate = (message: string) => z.iso.date(message);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "common.errors.textTooLong")
    .optional()
    .transform((v) => v || null);

/** S21-05: licencia o incapacidad de un trabajador. */
export const leaveSchema = z
  .object({
    worker_id: z.uuid("payroll.errors.workerRequired"),
    type: z.enum(LEAVE_TYPE_IDS, { error: "payroll.errors.leaveTypeRequired" }),
    start_date: isoDate("payroll.errors.startDateInvalid"),
    end_date: isoDate("payroll.errors.endDateInvalid"),
    note: optionalText(300),
  })
  .refine((d) => d.end_date >= d.start_date, {
    message: "payroll.errors.endBeforeStart",
    path: ["end_date"],
  });

/** S21-05: período de nómina. */
export const periodSchema = z
  .object({
    period_start: isoDate("payroll.errors.startDateInvalid"),
    period_end: isoDate("payroll.errors.endDateInvalid"),
  })
  .refine((d) => d.period_end >= d.period_start, {
    message: "payroll.errors.endBeforeStart",
    path: ["period_end"],
  });

const hours = () => z.coerce.number().min(0, "payroll.errors.hoursNegative").default(0);

/** S21-05: novedades de un trabajador en el período (días, horas extra, horas trabajadas). */
export const noveltiesSchema = z.object({
  days_worked: z.coerce.number().min(0, "payroll.errors.daysInvalid").max(30, "payroll.errors.daysMax").default(0),
  extra_diurna: hours(),
  extra_nocturna: hours(),
  recargo_nocturno: hours(),
  horas_dominical_festivo: hours(),
  hours_worked: hours(),
  weekly_hours: hours(),
});

/** S21-05: datos de la empresa para la nómina electrónica DIAN. */
export const dianSettingsSchema = z.object({
  nit: z.string().trim().regex(/^\d{5,15}$/, "payroll.errors.nitFormat"),
  dv: z.string().trim().regex(/^\d$/, "payroll.errors.dvFormat"),
  company_name: z.string().trim().min(1, "payroll.errors.companyNameRequired").max(200),
  software_id: z.string().trim().min(1, "payroll.errors.softwareIdRequired").max(100),
  software_pin: z.string().trim().min(1, "payroll.errors.softwarePinRequired").max(100),
  test_set_id: optionalText(100),
  address: optionalText(200),
  city: optionalText(80),
  department: optionalText(80),
  email: z
    .union([z.literal(""), z.email("customers.errors.emailInvalid")])
    .optional()
    .transform((v) => v || null),
  phone: optionalText(30),
});
