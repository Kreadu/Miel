---
id: S20-06
titulo: Idiomas (es/en/fr) — módulo 6 de 7: Resultados y Finanzas (incluye asesor con IA)
estado: implemented
depende_de: [S20-05]
---

# S20-06 — Idiomas: Resultados y Finanzas

## Contexto

Sexto módulo de E20 (ADR-040). Mismo patrón que S20-01..05. Particularidad: la salud de la
empresa (`lib/finance/health.ts`) hoy arma frases en español, y el asesor con IA (ADR-039)
responde siempre en español.

## Alcance

- `/resultados`: estado de resultados, gráficos, salud de la empresa, datos fiscales, asesor.
- `/finanzas`: gráficos de estado de resultados, flujo de caja y gastos (categorías de Miel
  traducidas con `categoryLabel`, S20-05).
- Acciones/Zod: `actions/{advisor,fiscal}.ts`, `lib/validation/{advisor,fiscal}.ts` → claves.
- **Salud:** `assessHealth` deja de devolver frases; devuelve datos (id, estado, valor numérico,
  tipo de resumen y conteo). La pantalla arma el texto con los mensajes del idioma.
- **Asesor con IA:** responde en el idioma de la pantalla (es/en/fr). El bloque de datos que
  recibe la IA sigue en español (es interno, el usuario no lo ve); solo cambia la instrucción de
  idioma de la respuesta. Las respuestas ya guardadas quedan en el idioma en que se pidieron.

Fuera de alcance: formato de dinero y fechas sigue colombiano (ADR-040).

## Criterios

- Ninguna pantalla del alcance muestra texto en español fijo cuando el idioma es en/fr.
- `health.test.ts` compara datos (estado, tipo de resumen), no frases.
- Test del asesor: la instrucción de sistema pide la respuesta en el idioma recibido.
- Acciones devuelven claves; `messages.test.ts` en verde. Lint, tsc, `npm test`; navegador del
  humano (la IA real sigue sin llave: se ve el aviso "no configurada" traducido).

## Notas de implementación

- `assessHealth` devuelve `{ indicators: { id, status, value }[], summary: { kind, count } }`; el
  texto vive en `results.health.*` (con plural ICU). `advisor-context.ts` arma su propia versión
  en español para la IA.
- `lib/ai/advisor.ts`: `advisorSystem(locale)` reemplaza `ADVISOR_SYSTEM`; `askModel` recibe el
  idioma; `askAdvisor` lo toma de `getLocale()`. Test nuevo `lib/ai/advisor.test.ts`.
- Nombres de mes de Resultados en el idioma de la pantalla (`Intl` es-CO/en-US/fr-FR); las cifras
  siguen en formato colombiano. Desviación menor de ADR-040 (solo palabras, no números).
- Finanzas: categorías con `categoryLabel` (se agregó "Nómina", la que usa `monthly_expenses`).
- Límites en mensajes: "20 preguntas por día" y "24 meses" van escritos en el texto (constantes
  `ADVISOR_DAILY_LIMIT`, `MAX_MONTHS`); si cambian, actualizar los mensajes.
