---
id: S9-03
titulo: Deploy en Vercel + Supabase cloud
estado: implemented      # draft → approved → implemented
depende_de: [S1-01, S1-02, S1-03, S1-04, S1-05, S2-01, S2-02, S2-03, S2-04, S2-05, S3-01, S3-02, S3-03, S3-04, S4-01, S4-02, S5-01, S5-02, S5-03, S5-04, S5-05, S5-06, S5-07, S5-08, S5-09, S5-10, S6-01, S6-02, S7-01, S7-02, S7-03, S8-01, S8-02, S9-01, S9-02, S9-04]
---

# S9-03 — Deploy en Vercel + Supabase cloud

## Contexto y valor

Última historia del MVP. Todo el desarrollo hasta hoy vivió en local (Supabase CLI + `next dev`).
Para invitar beta testers reales se necesita un entorno accesible por internet: proyecto Supabase
cloud con las 31 migraciones aplicadas, y la app Next.js desplegada en Vercel apuntando a ese
proyecto. Sin código de producción nuevo — es una historia de infraestructura y documentación.

## Alcance

- Crear proyecto Supabase cloud y aplicar las migraciones existentes (`supabase db push`).
- Configurar Supabase Auth (Site URL + Redirect URLs) para el dominio de Vercel.
- Crear proyecto Vercel enlazado al repo, con las env vars públicas de Supabase cloud.
- Verificar en runtime real que los headers de seguridad (S9-04) siguen correctos en Vercel
  (sin duplicados, `connect-src` con la URL cloud).
- Runbook reproducible en `docs/deploy.md` para futuros re-deploys o un segundo ambiente.
- Checklist operativo de pausa por inactividad del free-tier de Supabase (`docs/arch/stack.md`).

## NO-alcance (explícito)

- Dominio propio / DNS custom (se usa el dominio `*.vercel.app` por defecto).
- CI/CD de deploy automático más allá de lo que Vercel hace por defecto al conectar el repo
  (auto-deploy en push a `main`); no se configuran gates adicionales de Vercel en esta historia.
- Plan de pago (Vercel Pro / Supabase Pro) — se queda en free tier para el MVP/beta, según
  `docs/arch/stack.md`.
- Poblar el proyecto cloud con el seed de demo (`npm run seed`) — queda como paso **opcional**
  documentado en el runbook, no como criterio de aceptación de esta historia.
- Cambios de código en `src/` — el código ya es cloud-ready (env vars públicas, sin
  `service_role`, CSP dinámico). Solo se toca código si la verificación real revela un problema
  (p. ej. HSTS duplicado por Vercel).

## Criterios de aceptación (máx ~5)

1. **Dado** un proyecto Supabase cloud nuevo, **cuando** se ejecuta `supabase db push` con el
   proyecto linkeado, **entonces** las 31 migraciones se aplican sin error (incluye el grant
   acotado de `service_role`, ADR-023).
2. **Dado** el proyecto Vercel enlazado al repo con `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` configuradas apuntando al proyecto cloud, **cuando** se hace
   deploy a producción, **entonces** el dominio `*.vercel.app` responde 200 y la app carga.
3. **Dado** el dominio de Vercel agregado a Site URL/Redirect URLs de Supabase Auth, **cuando** un
   usuario real hace login (o signup + onboarding) en ese dominio, **entonces** llega a `/inicio`
   con sesión válida (cookies de `@supabase/ssr` funcionando cross-domain).
4. **Dado** el sitio desplegado, **cuando** se inspecciona `curl -sI` sobre el dominio de
   producción, **entonces** los 5 headers de S9-04 están presentes, `Strict-Transport-Security`
   aparece una sola vez (no duplicado por la plataforma), y el `connect-src` de la CSP contiene la
   URL del proyecto Supabase cloud (no `localhost`).
5. **Dado** el runbook `docs/deploy.md`, **cuando** se sigue paso a paso desde cero (proyecto
   Supabase + Vercel inexistentes), **entonces** es suficiente para reproducir el deploy sin
   conocimiento tácito adicional — incluye el checklist de pausa por inactividad del free-tier.

## Modelo de datos y migraciones

N/A — no se crean tablas ni migraciones nuevas. Se reutilizan las 31 migraciones existentes de
`supabase/migrations/`, aplicadas tal cual contra el proyecto cloud vía `supabase db push`.

## Políticas RLS requeridas

N/A — ninguna política nueva. Las RLS existentes viajan con las migraciones aplicadas.

## Funciones RPC e invariantes

N/A — ninguna RPC nueva.

## Casos borde

- **Auth redirect URL no configurada**: login/signup funcionan pero `resetPasswordForEmail` /
  confirmación de email redirigen a `localhost` → el runbook exige configurar Site URL +
  Redirect URLs de Supabase Auth con el dominio Vercel *antes* de probar esos flujos.
- **Vercel emite su propio HSTS**: si `curl -sI` muestra `Strict-Transport-Security` duplicado,
  se retira el header de `next.config.ts` (Vercel ya lo gestiona a nivel de edge) y se documenta
  en un ADR nuevo. Solo se actúa si la evidencia real lo confirma.
- **`service_role` clave**: nunca se carga como env var en el proyecto Vercel — la app no la usa
  (regla #3 de AGENTS.md); si se necesita para un script administrativo (`npm run seed` contra
  cloud), se ejecuta localmente con `.env.local` apuntando a la URL cloud, nunca desde Vercel.
- **Free tier pausado**: si el proyecto Supabase lleva ~7 días sin queries, se pausa
  automáticamente y la app cloud deja de responder — el runbook documenta cómo reactivarlo desde
  el dashboard antes de una demo.
- **`supabase db push` con drift**: si el historial de migraciones remoto difiere del local
  (proyecto no estaba realmente vacío), `supabase db push` puede fallar o pedir `--include-all` —
  el runbook documenta verificar `supabase migration list` antes de forzar.

## Consideraciones de seguridad (docs/arch/seguridad.md)

- Headers de seguridad (CSP, HSTS, Permissions-Policy, Referrer-Policy, X-Content-Type-Options)
  ya viven en `next.config.ts` (S9-04) — esta historia solo **verifica** que sobrevivan intactos
  en el runtime real de Vercel (criterio 4).
- `SUPABASE_SERVICE_ROLE_KEY` no se configura en Vercel (regla #3 de AGENTS.md) — la app en
  producción solo usa las claves públicas `NEXT_PUBLIC_*`.
- Supabase Auth Redirect URLs se acota explícitamente al dominio de Vercel (evita open-redirect
  vía `redirect_to` hacia dominios no autorizados — Supabase valida contra la allowlist
  configurada en el dashboard).
- Sin datos no confiables de terceros involucrados en esta historia (infra pura).

## Plan de tests (qué test cubre qué criterio)

Historia de infraestructura: no hay tests automatizados nuevos (pgTAP/Vitest) porque no hay
código ni esquema nuevo. Verificación manual real por el humano, documentada en el runbook y en
el Historial de esta spec (regla #9 — nunca declarada sin evidencia):

| Criterio | Tipo | Verificación | Qué comprueba |
|---|---|---|---|
| 1 | Manual (CLI) | `supabase db push` + `supabase migration list` | 31 migraciones aplicadas en cloud sin error |
| 2 | Manual (browser/curl) | `curl -sI https://<dominio>.vercel.app` → 200 | App accesible en producción |
| 3 | Manual (browser) | Login/signup real en el dominio de Vercel | Sesión válida, cookies cross-domain ok |
| 4 | Manual (curl) | `curl -sI` inspeccionando los 5 headers | Headers de S9-04 intactos, sin duplicados, CSP con URL cloud |
| 5 | Manual (revisión) | Seguir `docs/deploy.md` desde cero | Runbook reproducible, sin pasos tácitos faltantes |

## Historial
- 2026-07-21 · creada (draft) — agente, sesión de deploy. Alcance y criterios acordados con el
  humano vía `AskUserQuestion`: parte de cero (sin proyectos cloud previos), el agente entrega
  spec + runbook, el humano ejecuta el deploy real con asistencia en vivo.
- 2026-07-21 · aprobada (approved) por el humano, sin cambios sobre el draft.
- 2026-07-21 · implementada y verificada en verde, los 5 criterios confirmados con evidencia real
  (regla #9, no solo declarada):
  1. Proyecto Supabase cloud `miel-supa` (ref `alokgdakvqrvtocwsndr`, West US/Oregon) creado;
     `supabase link` + `supabase db push` aplicaron las 31 migraciones sin error;
     `supabase migration list` confirmó Local=Remote en las 31 tras el push.
  2. Proyecto Vercel desplegado en `https://miel-eight.vercel.app/`; `curl -sI` → `HTTP/2 200`.
  3. Tras configurar Site URL + Redirect URLs en Supabase Auth con el dominio de Vercel, login
     real del humano en producción → sesión válida.
  4. `curl -sI https://miel-eight.vercel.app/` confirmó los 5 headers de S9-04 presentes,
     `strict-transport-security` sin duplicar (Vercel no inyecta el suyo), y `connect-src` de la
     CSP apuntando a `https://alokgdakvqrvtocwsndr.supabase.co` (no localhost). Sin necesidad del
     ajuste contingente de HSTS previsto en el plan.
  5. Runbook `docs/deploy.md` seguido paso a paso por el humano desde cero, sin pasos tácitos
     faltantes — confirmado por la ejecución real de esta sesión.
  - **Hallazgo fuera de alcance de esta historia**: el signup (S1-02) no avisa "confirmá tu
    correo" tras registrarse — el humano quedó bloqueado en el primer login sin saber la causa.
    Decisión del humano (vía `AskUserQuestion`): desactivar "Confirm email" en Supabase Auth para
    el período de beta (config de infraestructura, no de código) + anotar como deuda de UI en
    `docs/BACKLOG.md` (mostrar aviso de confirmación tras signup) para cuando se reactive la
    confirmación de cara a producción real. No se implementa en esta historia (fuera de su
    alcance, regla de "una historia por sesión").
