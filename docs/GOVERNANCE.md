---
topic: gobernanza-sdd-tdd
status: vigente
related: [BACKLOG.md, ../specs/TEMPLATE.md, arch/convenciones-sql.md]
---

# Gobernanza: SDD + TDD

Principio rector: **solo cuenta la gobernanza que una máquina hace cumplir.** Toda regla
importante tiene su gate en CI o su casilla en la Definition of Done.

## Flujo por historia (SDD)

```
BACKLOG (todo)
  → redactar spec desde specs/TEMPLATE.md ................. estado: spec-ready
  → APROBACIÓN HUMANA de la spec (único gate manual) ...... estado spec: approved
  → escribir tests desde los criterios (deben fallar)
  → implementar hasta verde ............................... estado: in-progress
  → DoD completa .......................................... estado: done
```

- La spec es el contrato: dice exactamente qué comportamiento es correcto, no cómo codificarlo.
- **Spec drift = bug de proceso**: si implementar exige desviarse, se actualiza la spec PRIMERO
  y se anota el cambio en su historial.
- El humano concentra su revisión en aprobar specs, no en releer cada línea de código.

## Definition of Ready (para empezar a implementar)
- Spec en estado `approved`.
- Dependencias de la historia en `done` (ver BACKLOG).
- Cabe en una sesión: ≤ ~5 criterios de aceptación. Si no cabe, se parte en dos historias.

## Definition of Done
Ver checklist en `AGENTS.md` (lint, tsc, tests verdes, migraciones, spec `implemented`,
BACKLOG y SESSION_LOG actualizados).

## Pirámide de tests (TDD adaptado a este stack)

1. **pgTAP (supabase/tests/) — el corazón.** La seguridad multitenant (RLS) y los invariantes
   del ERP (RPC) viven en Postgres; se testean en Postgres. Cada tabla: test de aislamiento.
   Cada RPC: caso feliz + cada violación de invariante + atomicidad.
2. **Vitest (src/**/*.test.ts)** — lógica pura: schemas Zod, cálculos, formateo.
3. **Playwright (e2e/)** — dos proyectos (`playwright.config.ts`): `desktop` corre el humo de
   negocio (login → producto → movimiento → venta → despacho); `mobile` corre el gate de
   gobernanza mobile-first (ADR-025, `e2e/responsive.spec.ts`) — sin scroll horizontal del body
   a 375px en rutas públicas y autenticadas. Los flujos exhaustivos ya están cubiertos por las
   capas de abajo.

Orden TDD: los tests se escriben desde los criterios de la spec ANTES de implementar,
se ven fallar, y la implementación los pone en verde.

## Gates de CI (bloqueantes, .github/workflows/ci.yml)
- `lint` + `tsc --noEmit` + `vitest run` en cada push y PR.
- `npm audit --omit=dev --audit-level=high`: dependencias de producción con vulnerabilidad
  high/critical rompen el pipeline (ADR-020).
- Job `secrets`: gitleaks escanea el historial completo en busca de secretos commiteados
  (ADR-020). Si un secreto llega al historial: rotarlo, no reescribir el historial.
- Job de BD: Supabase CLI levanta Postgres, aplica migraciones, corre `supabase test db`.
- **Test guardián** (`supabase/tests/00-rls-guard.sql`): toda tabla de `public` con RLS
  habilitado y ≥1 política. Una migración sin RLS rompe el pipeline sola.
- **`.github/workflows/e2e.yml`**: levanta Supabase local y corre `npm run test:e2e` (los dos
  proyectos Playwright, ver pirámide de tests arriba). Incluye el gate responsive (ADR-025); un
  `test.fixme` documentado no rompe el pipeline pero tampoco cuenta como verde — queda visible en
  el reporte hasta que se cierre la historia que lo motiva.

## Anti-patrones de proceso (rechazar en revisión)
1. Spec gigante → partir sin piedad.
2. "El test es obvio, lo salto" → el CI existe porque esto pasa.
3. Refactor oportunista fuera de la spec → historia nueva en BACKLOG.
4. Documento nuevo sin registrar en INDEX.md → gobernanza aspiracional, no ejecutable.
