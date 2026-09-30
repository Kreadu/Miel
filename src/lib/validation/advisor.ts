import { z } from "zod";

import { MAX_MONTHS, monthRange } from "@/lib/finance/range";

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes inválido");

/** S22-03: pregunta al asesor con IA sobre un rango de meses. */
export const advisorQuestionSchema = z
  .object({
    question: z.string().trim().min(3, "Escribe tu pregunta").max(1000, "La pregunta es muy larga (máx. 1000 caracteres)"),
    desde: month,
    hasta: month,
  })
  .refine((d) => d.desde <= d.hasta, { message: "El mes inicial debe ser anterior al final", path: ["desde"] })
  .refine((d) => d.desde > d.hasta || monthRange(d.desde, d.hasta).length <= MAX_MONTHS, {
    message: `El rango no puede superar ${MAX_MONTHS} meses`,
    path: ["desde"],
  });

/** Preguntas por empresa por día (costo). */
export const ADVISOR_DAILY_LIMIT = 20;
