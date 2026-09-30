---
id: S20-07
titulo: Idiomas (es/en/fr) — módulo 7 de 7: RRHH y nómina
estado: implemented
depende_de: [S20-06]
---

# S20-07 — Idiomas: RRHH y nómina

## Contexto

Último módulo de E20 (ADR-040). Mismo patrón que S20-01..06. Figuras colombianas traducidas con
su sigla (p. ej. "Payroll (nómina)", "Electronic payroll (DIAN)", "PILA", "CC", "ARL").

## Alcance

Pantallas de `src/app/(app)/equipo/`: portada de RRHH, trabajadores (lista, ficha/formulario,
cargo, categoría, acceso), temporales, cargos, categorías de acceso, licencias, usuarios (resto
de la pantalla; el formulario de invitación ya está), uso, nómina (períodos, liquidación por
trabajador, nómina electrónica DIAN).

Etiquetas de `lib/rrhh/workers.ts` (tipos de trabajador, contrato, jornada, documento,
clasificación de costo, módulos) → claves de mensajes.

Acciones y validaciones: `actions/{workers,payroll}.ts`, `lib/validation/{workers,payroll}.ts`
→ claves (`workers.errors.*`, `payroll.errors.*`).

Fuera de alcance:
- El motor de nómina (`lib/rrhh/engine`, copiado de Gestion-Future, ADR-036) y el XML de
  nómina electrónica / documento soporte: son cálculo y documentos legales colombianos, quedan en
  español. Solo se traducen las pantallas que los muestran.
- Formato de dinero y fechas sigue colombiano.

## Criterios

- Ninguna pantalla del alcance muestra texto en español fijo cuando el idioma es en/fr.
- Acciones devuelven claves; los tests de acciones/validación comparan claves.
- `src/i18n/messages.test.ts` en verde. Lint, tsc, `npm test`; navegador del humano.
- Con esta historia, E20 queda completa: barrido final de `src/app` buscando texto en español
  fijo; lo que quede fuera se anota en BACKLOG.

## Notas de implementación

- `lib/rrhh/workers.ts`: `DOC_TYPES`, `CONTRACT_TYPES`, `WORK_SCHEDULES`, `WORKER_TYPES`,
  `COST_CLASSIFICATIONS` pasan de objeto {clave: texto} a lista de claves; `WORKER_MODULES` sin
  `label`; se quitó `keysOf`. Borrados por huérfanos: `LEAVE_TYPES` (payroll-input) y
  `ACTIVITY_LABEL` (activity/log). Etiquetas en `rrhh.*`.
- `LEAVE_TYPE_IDS` se exporta desde `lib/validation/payroll.ts`.
- El formulario de invitación (dejado a propósito para este módulo) quedó traducido
  (`rrhh.invite.*`).
- Quedan en español por diseño: errores y notas que devuelve el motor de nómina (se guardan en
  `payroll_settlements.result` y se muestran tal cual) y el XML DIAN.
- Barrido final de `src/app` y `src/components`: pendientes anotados en BACKLOG (E20, "Fuera de E20").
