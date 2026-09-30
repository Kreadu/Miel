---
id: S21-01
titulo: Motor de nómina de Gestion-Future copiado a Miel (sin vínculo)
estado: implemented
depende_de: []
---

# S21-01 — Motor de nómina en RRHH

## Contexto y valor

Pedido del humano 2026-09-29: traer a RRHH la nómina y contratación de Gestion-Future sin que
los proyectos queden unidos. Primer paso acordado: copiar la lógica de cálculo. Ver ADR-036.

## Alcance

- Copia a `src/lib/rrhh/` de: `engine/countries/colombiaEngine.ts`, `constants2026.ts`,
  `engine/hourly/partTimeEmployeeEngine.ts`, `independentContractorEngine.ts`,
  `types/payroll.ts`, `types/hourly.ts`, `services/dianNominaXmlService.ts`,
  `documentoSoporteService.ts`, `dateRanges.ts`. Encabezado de origen en cada archivo.
- Tests copiados junto al código (convención Miel): `colombiaEngineCompliance`, `employeeLeaves`,
  `hourlyEngines`, `payrollAndDian`, `dateRanges` — `@jest/globals` → `vitest`.

## NO-alcance

- API del Worker, D1, Firebase Auth, contadores DIAN (dependían de D1), dashboard HTML, portal
  del empleado: se rehacen en historias siguientes (E21).
- Sin pantallas todavía: el motor aún no se usa desde la app.

## Criterios de aceptación

1. Los 56 tests del motor pasan en Miel.
2. `tsc` y lint limpios; Gestion-Future sin cambios.
