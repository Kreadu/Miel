import { z } from "zod";

import { MAX_MONTHS, monthRange } from "@/lib/finance/range";

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "advisor.errors.monthInvalid");

/** S22-03: pregunta al asesor con IA sobre un rango de meses. */
export const advisorQuestionSchema = z
  .object({
    question: z.string().trim().min(3, "advisor.errors.questionRequired").max(1000, "advisor.errors.questionTooLong"),
    desde: month,
    hasta: month,
  })
  .refine((d) => d.desde <= d.hasta, { message: "advisor.errors.rangeOrder", path: ["desde"] })
  .refine((d) => d.desde > d.hasta || monthRange(d.desde, d.hasta).length <= MAX_MONTHS, {
    message: "advisor.errors.rangeTooLong",
    path: ["desde"],
  });

/** Preguntas por empresa por día (costo). */
export const ADVISOR_DAILY_LIMIT = 20;
