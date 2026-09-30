import { z } from "zod";

import { CONTRACT_TYPES, DOC_TYPES, WORK_SCHEDULES, WORKER_MODULE_IDS, keysOf } from "@/lib/rrhh/workers";

/** Texto opcional de formulario: recortado, y vacío → null (columna nullable). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Texto muy largo")
    .optional()
    .transform((v) => v || null);

/** S21-02: categoría de trabajador = qué módulos ve. */
export const workerCategorySchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60, "Nombre muy largo"),
  modules: z.array(z.enum(WORKER_MODULE_IDS)),
});

/** S21-02: ficha del trabajador. */
export const workerSchema = z.object({
  full_name: z.string().trim().min(1, "El nombre es obligatorio").max(120, "Nombre muy largo"),
  doc_type: z.enum(keysOf(DOC_TYPES)).default("cc"),
  doc_number: z.string().trim().min(1, "El documento es obligatorio").max(30, "Documento muy largo"),
  position: optionalText(80),
  hire_date: z
    .union([z.literal(""), z.iso.date("Fecha de ingreso inválida")])
    .optional()
    .transform((v) => v || null),
  contract_type: z.enum(keysOf(CONTRACT_TYPES)).default("indefinido"),
  salary: z.coerce.number().nonnegative("El salario no puede ser negativo").default(0),
  work_schedule: z.enum(keysOf(WORK_SCHEDULES)).default("completa"),
  eps: optionalText(80),
  pension_fund: optionalText(80),
  arl_risk_class: z
    .union([z.literal(""), z.coerce.number().int().min(1, "Clase de riesgo de 1 a 5").max(5, "Clase de riesgo de 1 a 5")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  phone: optionalText(30),
  email: z
    .union([z.literal(""), z.email("Correo inválido").max(160)])
    .optional()
    .transform((v) => v || null),
  address: optionalText(200),
  warehouse_id: z.uuid().optional().or(z.literal("")),
  category_id: z.uuid().optional().or(z.literal("")),
});
