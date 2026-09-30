import { z } from "zod";

const LEAVE_TYPE_IDS = ["GENERAL_INCAPACITY", "WORK_INCAPACITY", "MATERNITY_LEAVE", "PATERNITY_LEAVE"] as const;
const isoDate = (message: string) => z.iso.date(message);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Texto muy largo")
    .optional()
    .transform((v) => v || null);

/** S21-05: licencia o incapacidad de un trabajador. */
export const leaveSchema = z
  .object({
    worker_id: z.uuid("Elige un trabajador."),
    type: z.enum(LEAVE_TYPE_IDS, { error: "Elige el tipo de licencia." }),
    start_date: isoDate("Fecha de inicio inválida"),
    end_date: isoDate("Fecha de fin inválida"),
    note: optionalText(300),
  })
  .refine((d) => d.end_date >= d.start_date, {
    message: "La fecha de fin no puede ser anterior al inicio.",
    path: ["end_date"],
  });

/** S21-05: período de nómina. */
export const periodSchema = z
  .object({
    period_start: isoDate("Fecha de inicio inválida"),
    period_end: isoDate("Fecha de fin inválida"),
  })
  .refine((d) => d.period_end >= d.period_start, {
    message: "La fecha de fin no puede ser anterior al inicio.",
    path: ["period_end"],
  });

const hours = (label: string) => z.coerce.number().min(0, `${label} no puede ser negativo`).default(0);

/** S21-05: novedades de un trabajador en el período (días, horas extra, horas trabajadas). */
export const noveltiesSchema = z.object({
  days_worked: z.coerce.number().min(0, "Días inválidos").max(30, "Máximo 30 días").default(0),
  extra_diurna: hours("Extra diurna"),
  extra_nocturna: hours("Extra nocturna"),
  recargo_nocturno: hours("Recargo nocturno"),
  horas_dominical_festivo: hours("Dominical o festivo"),
  hours_worked: hours("Horas trabajadas"),
  weekly_hours: hours("Horas semanales"),
});

/** S21-05: datos de la empresa para la nómina electrónica DIAN. */
export const dianSettingsSchema = z.object({
  nit: z.string().trim().regex(/^\d{5,15}$/, "El NIT va solo con números, sin dígito de verificación"),
  dv: z.string().trim().regex(/^\d$/, "El dígito de verificación es un solo número"),
  company_name: z.string().trim().min(1, "La razón social es obligatoria").max(200),
  software_id: z.string().trim().min(1, "El identificador de software es obligatorio").max(100),
  software_pin: z.string().trim().min(1, "El PIN del software es obligatorio").max(100),
  test_set_id: optionalText(100),
  address: optionalText(200),
  city: optionalText(80),
  department: optionalText(80),
  email: z
    .union([z.literal(""), z.email("Correo inválido")])
    .optional()
    .transform((v) => v || null),
  phone: optionalText(30),
});
