# INDEX — Manifiesto de la wiki de Miel

Punto de entrada único a la documentación. Lee esta página y carga SOLO lo que tu tarea necesita.
Regla: toda página nueva de docs/ se registra aquí con una línea y su "cuándo leerla".

## Gobernanza y proceso
- `GOVERNANCE.md` — Flujo SDD+TDD, DoR/DoD, gates de CI. **Leer**: al escribir specs, tests, o dudar del proceso.
- `DECISIONS.md` — ADRs append-only con el porqué de cada decisión. **Leer**: antes de proponer un cambio de arquitectura o dependencia.
- `BACKLOG.md` — Épicas e historias con estado y dependencias. **Leer**: al iniciar toda sesión.
- `SPRINTS.md` — Plan de sprints 0–6 y orden de dependencias. **Leer**: al planear o elegir historia.
- `SESSION_LOG.md` — Bitácora de las últimas ~5 sesiones. **Leer**: al iniciar toda sesión.

## Operación
- `deploy.md` — Runbook de deploy en Vercel + Supabase cloud (S9-03). **Leer**: al hacer el
  primer deploy, un re-deploy, o al levantar un segundo ambiente.

## Arquitectura (docs/arch/)
- `arch/stack.md` — Stack, hosting y límites de free tier. **Leer**: setup, deploy, o dudas de infraestructura.
- `arch/multitenancy-rls.md` — Modelo tenant/membership y patrón de políticas RLS. **Leer**: toda historia que cree tablas o toque permisos.
- `arch/patron-rpc.md` — Invariantes transaccionales en funciones Postgres. **Leer**: toda historia con escrituras de negocio (stock, compras, pagos).
- `arch/convenciones-sql.md` — Naming, tipos monetarios, auditoría created_by, migraciones forward-only, pgTAP. **Leer**: antes de escribir cualquier migración o test de BD.
- `arch/permisos-roles.md` — Matriz de permisos rol × módulo y cómo se materializa en RLS/UI. **Leer**: toda historia con políticas por rol o UI condicionada a rol.
- `arch/seguridad.md` — Estándar de seguridad (OWASP + agéntica/prompt injection) y checklist de salida. **Leer**: toda historia que toque boundaries de servidor, auth, redirects o UI con datos de usuario; y antes de diseñar cualquier feature con LLM.

## Modelo de datos
- `data-model.md` — Esquema completo del MVP por módulo. **Leer**: historias que creen o consulten tablas; cargar solo la sección del módulo relevante.
- `arch/diagrama-er.md` — Diagrama ER mermaid de conjunto. **Leer**: para visión global de entidades y relaciones; el detalle manda en data-model.md.

## Specs (fuera de docs/, en specs/)
- `specs/TEMPLATE.md` — Plantilla obligatoria de spec.
- `specs/S*-*.md` — Specs activas. `specs/done/` — implementadas (no leer por defecto).

## Código (skills de proyecto, .claude/skills/)
- `nextjs-miel/SKILL.md` — Convenciones de Next.js del repo. **Leer**: antes de tocar `src/`.
- `ponytail/SKILL.md` — Minimalismo de implementación (intensidad `full`). **Leer**: antes de tocar `src/` (ADR-007).
- `miel-design/SKILL.md` — Design system e identidad visual (tokens, estados, a11y). **Leer**: antes de tocar UI (ADR-008).
- `supabase-miel/SKILL.md` — Procedimiento de migraciones, RPCs y tests pgTAP. **Leer**: antes de tocar `supabase/` (ADR-009).

## Archivo
- `archive/` — Sesiones antiguas de SESSION_LOG. No leer por defecto.
