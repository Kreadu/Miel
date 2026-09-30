import { z } from "zod";

import {
  COST_CLASSIFICATIONS,
  CONTRACT_TYPES,
  DOC_TYPES,
  WORK_SCHEDULES,
  WORKER_MODULE_IDS,
  WORKER_TYPES,
} from "@/lib/rrhh/workers";

/** Texto opcional de formulario: recortado, y vacío → null (columna nullable). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "common.errors.textTooLong")
    .optional()
    .transform((v) => v || null);

/** S21-02: categoría de trabajador = qué módulos ve. */
export const workerCategorySchema = z.object({
  name: z.string().trim().min(1, "common.errors.nameRequired").max(60, "common.errors.nameTooLong"),
  modules: z.array(z.enum(WORKER_MODULE_IDS)),
});

/** S21-02c: cargo de la empresa. */
export const workerPositionSchema = z.object({
  name: z.string().trim().min(1, "common.errors.nameRequired").max(80, "common.errors.nameTooLong"),
});

const optionalDate = (message: string) =>
  z
    .union([z.literal(""), z.iso.date(message)])
    .optional()
    .transform((v) => v || null);

/** S21-02: ficha del trabajador. */
export const workerSchema = z.object({
  full_name: z.string().trim().min(1, "common.errors.nameRequired").max(120, "common.errors.nameTooLong"),
  doc_type: z.enum(DOC_TYPES).default("cc"),
  doc_number: z.string().trim().min(1, "workers.errors.docRequired").max(30, "customers.errors.docTooLong"),
  position_id: z.uuid().optional().or(z.literal("")),
  hire_date: optionalDate("workers.errors.hireDateInvalid"),
  // S21-02c: temporales tienen fecha de término; por horas, valor hora.
  worker_type: z.enum(WORKER_TYPES).default("planta"),
  end_date: optionalDate("workers.errors.endDateInvalid"),
  hourly_rate: z.coerce.number().nonnegative("workers.errors.hourlyRateNegative").default(0),
  contract_type: z.enum(CONTRACT_TYPES).default("indefinido"),
  salary: z.coerce.number().nonnegative("workers.errors.salaryNegative").default(0),
  work_schedule: z.enum(WORK_SCHEDULES).default("completa"),
  eps: optionalText(80),
  pension_fund: optionalText(80),
  arl_risk_class: z
    .union([z.literal(""), z.coerce.number().int().min(1, "workers.errors.riskClassRange").max(5, "workers.errors.riskClassRange")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  phone: optionalText(30),
  email: z
    .union([z.literal(""), z.email("customers.errors.emailInvalid").max(160)])
    .optional()
    .transform((v) => v || null),
  address: optionalText(200),
  // S21-04: su pago es gasto o costo, fijo o variable (para finanzas).
  cost_classification: z
    .union([z.literal(""), z.enum(COST_CLASSIFICATIONS)])
    .optional()
    .transform((v) => v || null),
  emergency_contact_name: optionalText(120),
  emergency_phone: optionalText(30),
  warehouse_id: z.uuid().optional().or(z.literal("")),
  category_id: z.uuid().optional().or(z.literal("")),
});
