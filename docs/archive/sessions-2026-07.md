# Archivo de sesiones — 2026-07

Entradas antiguas movidas desde SESSION_LOG.md.

---

## Sesión 2026-07-20 (r) · S1-05 implementada — invitaciones con rol (TDD). Cierra Sprint 1

**Alcance:** el humano aprobó `specs/S1-05-invitaciones-roles.md` (spec-ready → approved) y
se implementó completa con TDD en la misma sesión. Última historia de Sprint 1 (E1 —
Fundación multitenant).

**Hecho:**
- TDD real: `supabase/tests/S1-05-invitaciones.sql` (13 tests pgTAP) escrito primero y
  verificado en rojo (`relation "public.invitations" does not exist`); luego migración
  `supabase/migrations/20260720053746_invitations.sql` — tabla `invitations` (`tenant_id`,
  `email`, `role` check admin|member, `token` unique, `expires_at` default +7 días,
  `accepted_at`, `created_by`), RLS restringida a owner/admin vía el helper
  `user_is_tenant_admin()` (reusado de S1-01, sin política pública), `GRANT` explícito
  (necesario en local — ver rectificación de la sesión anterior), y RPC
  `accept_invitation(p_token)` `security definer` (ADR-018) con los 5 invariantes de la spec
  (token vigente, email del JWT coincide, sin membership previa, atómico). 30/30 pgTAP en
  verde (guardián + S1-01 + S1-03 + S1-05). Nota de test: el invitado no puede leer
  `invitations` por RLS (correcto — resuelve todo por la RPC), así que los tokens de fixture
  se capturaron con `postgres` + `\gset` antes de simular al invitado; y dos invitaciones al
  mismo email dentro de la misma transacción comparten `created_at` (`now()` es constante en
  transacción) — se usaron emails dedicados por caso para evitar `order by` ambiguo.
- `src/lib/validation/invitations.ts` (Zod: email + rol) con TDD Vitest primero.
  `src/actions/invitations.ts`: `createInvitation` (insert con columnas explícitas, RLS
  autoriza, retorna el enlace `/invite/<token>`), `revokeInvitation` (delete de pendiente),
  `acceptInvitation` (`.rpc()`, fija `active_tenant` con el helper compartido nuevo
  `src/lib/tenant/cookie.ts::writeActiveTenantCookie` — extraído de `actions/tenant.ts` para
  DRY, mismo helper que ahora usan `setActiveTenant` y `acceptInvitation` — y redirige a
  `/inicio`). "Equipo" sumado a `NAV_ITEMS` (owner/admin-only). Página
  `/(app)/equipo` (miembros solo por rol, sin email de terceros — decisión con el humano;
  invitaciones pendientes con email + revocar; formulario con enlace copiable) y página
  pública `/invite/[token]` (sin sesión → `/signup?next=...`, con sesión → aceptar). Se
  agregó el componente shadcn `select` (no existía) para el selector de rol.
  **Ajuste necesario no anticipado en la spec**: `/invite` no estaba en la allow-list
  pública de `src/proxy.ts` (S1-04) — un anónimo habría sido rebotado a `/login` antes de
  que la página pudiera enviarlo a `/signup`. Se agregó `/invite` a `PUBLIC_PATHS`.
- **Hallazgo TDD crítico (bug real de S1-04, expuesto por esta historia):**
  `getActiveTenant()` leía `memberships` sin filtrar `user_id`, asumiendo una fila por
  tenant — pero la política RLS de `memberships` es visible a todo el equipo del tenant (lo
  necesita `/equipo` para listar compañeros), no solo a la fila propia. Invisible mientras
  cada tenant tuvo un solo miembro (todo Sprint 1 hasta ahora); con ≥2 miembros la query
  devolvía una fila por compañero y `resolveActiveTenant` tomaba la primera por `tenant_id`
  (casi siempre la del owner, creada primero) — un `member` invitado terminaba viendo el rol
  y la navegación de **otro usuario** de su propio tenant. Ningún test automático lo
  cubría (ninguno probaba un tenant con 2+ miembros); se detectó con verificación manual real
  (Playwright + consulta directa a PostgREST con el token del invitado, contrastada contra
  la BD). Corregido con `.eq('user_id', user.id)` explícito en
  `src/lib/tenant/server.ts` (exactamente el caso que anticipa `nextjs-miel`: "filtro
  explícito solo cuando la semántica lo requiera"). Retrofit anotado en el historial de
  `specs/done/S1-04-layout-tenant-activo.md`.
- Verificado: lint ✓, tsc ✓, Vitest 35/35 ✓ (incluye `invitations.test.ts` y
  `nav-visibility.test.ts` actualizado), `supabase test db` 30/30 ✓, tipos regenerados
  (`src/lib/database.types.ts`), y los 5 criterios de aceptación con navegador real vía
  script Playwright desechable en el scratchpad (12 checks, no commiteado — e2e formal sigue
  en S9-01): owner (signup + onboarding) invita → invitado sin sesión rebota a
  `/signup?next=...` (no `/login`) → `next` preservado tras signup → acepta → `/inicio` con
  `active_tenant` y rol `member` correctos → `member` no ve "Equipo" en el sidebar ni puede
  resolver `/equipo` (404 real, confirmado tras esperar la re-renderización cliente de
  dev-mode) → token ya usado rechazado con mensaje genérico (sin enumeración) → la
  invitación aceptada ya no aparece como pendiente para el owner.
- Spec movida a `specs/done/S1-05-invitaciones-roles.md` (`implemented`). BACKLOG S1-05 →
  `done`. **Cierra Sprint 1 (E1 — Fundación multitenant): S1-01 a S1-05 completas.**

**Pendiente:**
- Humano: commitear (mensaje sugerido más abajo).
- **Nuevo, importante**: sumar un test pgTAP de aislamiento con un tenant de ≥2 miembros
  (uno owner, uno member) a `S1-01-aislamiento.sql` o a `S1-05-invitaciones.sql`, para que el
  bug de `getActiveTenant()` encontrado hoy quede cubierto en CI y no pueda reaparecer en
  un refactor futuro — hoy solo está probado manualmente.
- Siguen pendientes: validación estética humana claro/oscuro (sin hacer aún en ninguna
  página).

**Bloqueos:** ninguno.

**Siguiente paso:** Sprint 1 completo. Sprint 2 (E2 — Inventario) puede arrancar con S2-01
(bodegas); su spec aún no existe (`docs/BACKLOG.md` la marca `todo`) — la siguiente sesión
la redacta y el humano la aprueba antes de implementar, aplicando `supabase-miel` (ya no
hace falta la nota de `GRANT` explícito para el proyecto cloud gracias a ADR-021, pero sigue
siendo necesaria en local — ver ADR-021 y la rectificación de la sesión (q) para el criterio
exacto).

## Sesión 2026-07-20 (q) · Revisión pre-aprobación de S1-05 (invitaciones con rol)

**Alcance:** con S1-01…S1-04 en `done`, S1-05 (invitaciones + roles, cierra E1) quedó
desbloqueada pero su spec seguía en `estado: draft` (BACKLOG ya decía `spec-ready` — mismo
desfase de sincronía anotado en sesiones previas). El humano commiteó de paso ADR-021
(config de creación del proyecto Supabase: Data API + expose automático + automatic RLS)
antes de continuar. Solo revisión de spec — sin código, sin migraciones.

**Hecho:**
- Auditoría de `specs/S1-05-invitaciones-roles.md` contra `permisos-roles.md` y
  `seguridad.md`: la spec ya estaba madura (modelo, RLS, invariantes de
  `accept_invitation`, casos borde, sección ADR-020, plan de tests) y bien alineada de
  fondo. Los huecos encontrados eran de **integración con lo construido en S1-04**, no de
  fondo, y se cerraron con el humano:
  1. Ruta de la página de equipo fijada a `/(app)/equipo`, sumada a `NAV_ITEMS`
     (`src/lib/tenant/nav-visibility.ts`) visible solo owner/admin.
  2. `/invite/<token>` sin sesión redirige a `/signup?next=...` (no `/login` — el invitado
     es usuario nuevo por definición, no alguien con cuenta previa). Se verificó en código
     que el flujo `next` a través de signup **ya existe desde S1-02** sin cambios
     necesarios: `signup/page.tsx` lee `searchParams.next` → `SignupForm` lo reenvía como
     campo oculto → la action `signup` (`src/actions/auth.ts:32`) redirige con
     `safeNext(formData.get("next"))`.
  3. El redirect post-aceptación fija `active_tenant` al tenant recién aceptado reusando
     `setActiveTenant` (`src/actions/tenant.ts`, S1-04), en vez de depender del fallback
     "primera membership" de `resolveActiveTenant`.
- **ADR-021 retira una tarea pendiente arrastrada desde S1-01**: el expose automático de
  tablas hace obsoleto el `GRANT` explícito manual por migración que se venía anotando como
  pendiente en cada sesión — se retira de este SESSION_LOG (ver "Pendiente" abajo, ya no
  aparece).
- Front-matter de la spec: `draft` → `spec-ready` (coincide ahora con BACKLOG, que ya decía
  `spec-ready`). Historial de la spec actualizado con fecha y resumen de estos 3 ajustes.

**Pendiente:**
- Humano: **aprobar `specs/S1-05-invitaciones-roles.md`** (`spec-ready` → `approved`). Sin
  esto, la regla innegociable del flujo SDD prohíbe implementar.
- Validación estética humana claro/oscuro sigue sin hacerse en ninguna página (arrastrado de
  sesiones previas).

**Bloqueos:** ninguno — solo espera aprobación humana.

**Siguiente paso:** el humano aprueba `specs/S1-05-invitaciones-roles.md`; la sesión siguiente
la implementa con TDD (pgTAP de `invitations`/`accept_invitation` primero, luego migración,
RPC, página `/(app)/equipo` y `/invite/<token>`) aplicando `supabase-miel`, `nextjs-miel`,
`ponytail` full y `miel-design`. Cierra Sprint 1 (E1); tras S1-05, Sprint 2 (E2 —
Inventario) puede arrancar con S2-01 (bodegas).

## Sesión 2026-07-19/20 (p) · S1-04 implementada — layout de app, navegación y tenant activo (TDD)

**Alcance:** el humano decidió avanzar con S1-04 (siguiente historia de E1), aprobó la spec
en la misma sesión (draft → approved) fijando `/inicio` como ruta hogar del grupo `(app)`,
y se implementó completa con TDD.

**Hecho:**
- TDD real: `src/lib/tenant/{active-tenant,nav-visibility}.test.ts` (8 tests) escritos
  primero y verificados en rojo (`Failed to resolve import`); luego
  `src/lib/tenant/active-tenant.ts` (`resolveActiveTenant`: cookie coincide con membership
  del usuario → esa; si no, la primera; sin memberships → `null`) y
  `src/lib/tenant/nav-visibility.ts` (`NAV_ITEMS` declarativo + `visibleNavItems(role)`
  filtra Finanzas/Dashboard/Gastos para `member`, según `permisos-roles.md`) en verde.
- `src/lib/tenant/server.ts` — `getActiveTenant()`, único punto de lectura: un solo
  `select('tenant_id, role, tenants(name)')` con embed PostgREST (sin N+1), cookie
  `active_tenant` leída y validada con `resolveActiveTenant` (RLS ya filtra a las
  membresías del propio usuario). `src/actions/tenant.ts` — `setActiveTenant`: Zod (`z.uuid()`)
  antes de nada, confirma pertenencia con una query a `memberships` antes de fijar la
  cookie (httpOnly, `sameSite: lax`, `secure` en prod), `revalidatePath('/', 'layout')`.
- `src/app/(app)/layout.tsx` (server): `getActiveTenant()`; sin tenant → `redirect('/onboarding')`
  (cubre membership perdida en caliente). Sidebar con nombre/rol del tenant, `TenantSwitcher`
  (oculto con 1 sola empresa), enlace "crear otra empresa", `SidebarNav` (cliente) y menú de
  usuario (email + `ThemeToggle` + `logout`). `loading.tsx` con skeleton del layout.
  `inicio/page.tsx` como hogar neutral con accesos a los módulos visibles por rol.
  Placeholders "próximamente" (`ModulePlaceholder`) para los 7 módulos del MVP
  (inventario, compras, ventas, producción, gastos, finanzas, dashboard).
- **Hallazgo TDD (bug real durante la verificación manual, no solo el ejercicio rojo/verde):**
  pasar `NavItem[]` (con el componente de ícono, una función) como prop desde el Server
  Component `layout.tsx` al Client Component `SidebarNav` rompía en runtime
  ("Functions cannot be passed directly to Client Components") — invisible para
  `tsc`/lint/Vitest, solo se vio en el navegador real. Corregido: `SidebarNav` recibe
  `role` (serializable) y calcula `visibleNavItems(role)` internamente, en el cliente.
- Piezas existentes ajustadas: `DEFAULT_AUTHENTICATED_PATH` → `/inicio` (era `/onboarding`);
  `src/proxy.ts` invierte el criterio de protección — de una allow-list de rutas protegidas
  a una allow-list de rutas públicas (`/`, `/auth`, rutas `(auth)`) más "todo lo demás
  requiere sesión", así el grupo `(app)` completo queda protegido sin enumerar cada módulo;
  `onboarding/page.tsx` con tenant creado redirige a `/inicio` en vez de mostrar el placeholder
  "la app llega con S1-04"; `actions/onboarding.ts` redirige directo a `/inicio` (se quitó el
  salto intermedio por `/onboarding`).
- Verificado: lint ✓, tsc ✓ (el embed `tenants(name)` tipó como objeto, no array — sin
  ajuste necesario), Vitest 29/29 ✓, `supabase test db` 17/17 ✓ (sin cambios de esquema), y
  los 5 criterios de aceptación con navegador real vía script Playwright desechable en el
  scratchpad (no commiteado; e2e formal sigue en S9-01): anónimo a ruta protegida → `/login?next=`;
  autenticado sin membership → `/onboarding`; selector con 2 empresas actualiza el tenant
  mostrado tras recargar; cookie `active_tenant` manipulada a un tenant inexistente se
  descarta y cae a uno legítimo; owner ve Finanzas/Dashboard/Gastos (member los oculta,
  cubierto exhaustivamente por `nav-visibility.test.ts`) — 6 checks.
- Spec movida a `specs/done/S1-04-layout-tenant-activo.md` (`implemented`). BACKLOG S1-04
  → `done`. Sesión (k) archivada en `docs/archive/sessions-2026-07.md` (cupo de ~5 sesiones
  vigentes).

**Pendiente:**
- Humano: commitear (mensaje sugerido:
  `feat(S1-04): layout de app, navegación y tenant activo validado en servidor`).
- Siguen pendientes: nota de `GRANT` explícito en la plantilla de `supabase-miel` (antes de
  S2-01) y validación estética humana claro/oscuro (todavía no hecha en ninguna página).

**Bloqueos:** ninguno.

**Siguiente paso:** con S1-04 en `done`, S1-05 (invitaciones + roles) queda desbloqueada —
su spec (`specs/S1-05-invitaciones-roles.md`) sigue en `spec-ready`, el humano debe
aprobarla antes de implementar. Cierra Sprint 1 (E1); tras S1-05, Sprint 2 (E2 — Inventario)
puede arrancar con S2-01 (bodegas), recordando sumar la nota de `GRANT` explícito antes.

---

## Sesión 2026-07-19 (o) · S1-03 implementada — onboarding crear empresa (TDD)

**Alcance:** el humano pidió aprobar `specs/S1-03-onboarding-crear-empresa.md`; se hizo
auditoría pre-aprobación, se cerró el único hueco real, el humano aprobó (draft → approved)
y se implementó completa con TDD en la misma sesión.

**Hecho:**
- Auditoría pre-aprobación: la spec estaba bien alineada con ADR-018/019, la matriz de
  `permisos-roles.md` y `seguridad.md`. Único hueco: el destino del redirect post-creación
  no existe (grupo `(app)` + tenant activo son S1-04). Decisión del humano: reusar
  `/onboarding` con estado provisional "empresa creada" (sin ruta desechable nueva); S1-04
  reemplazará este destino. Spec ajustada (Alcance, criterio 1, `grant execute` explícito,
  enfoque de prueba de atomicidad del criterio 2) y aprobada.
- TDD real: `src/lib/validation/onboarding.test.ts` (5 tests) escrito primero y verificado en
  rojo; luego `onboarding.ts` (Zod, `name` requerido con trim, `nit` opcional) en verde.
  `supabase/tests/S1-03-onboarding.sql` (8 tests pgTAP) escrito primero contra la RPC
  inexistente; migración `20260720042954_create-tenant-with-owner.sql` después —
  `create_tenant_with_owner(p_name, p_nit default null)` `security definer` (ADR-018): valida
  `auth.uid()` y nombre no vacío, inserta tenant + membership owner en una transacción,
  `grant execute` a `authenticated`. Hallazgo TDD: el primer intento de C5 (anónimo) daba
  falso verde porque `set local "request.jwt.claims"` de un bloque previo persistía dentro de
  la misma transacción del test — se corrigió fijando claims propios para el rol `anon`.
- `src/actions/onboarding.ts`: `createTenant` — Zod antes de la RPC, columnas explícitas
  (`p_name`/`p_nit`, sin spread), error de Postgres mapeado a mensaje genérico en español,
  `redirect('/onboarding')` fuera del try/catch (patrón de `actions/auth.ts`).
  `src/app/onboarding/page.tsx` reemplaza el stub de S1-02: server component que cuenta
  memberships del usuario (RLS ya filtra) — sin membership muestra el formulario
  (`onboarding-form.tsx`, cliente, `useActionState`, tokens `miel-design`); con ≥1 membership
  muestra estado "Empresa creada" + link "crear otra empresa" (`?crear`) + logout.
- Verificado: lint ✓, tsc ✓ (tipos regenerados con `supabase gen types`; se detectó que
  redirigir stdout de `gen types` sin separar stderr metía "Connecting to db 5432" al archivo
  — corregido separando streams), `supabase db reset` limpio, `supabase test db` 17/17 ✓
  (guardián + S1-01 + S1-03), Vitest 21/21 ✓, y flujo completo con navegador real vía script
  Playwright desechable en el scratchpad (signup → formulario → nombre vacío rechazado →
  crear empresa → estado "creada" → crear otra → logout → anónimo rebota a `/login`; 10
  checks, no commiteado — e2e formal sigue en S9-01).
- Spec movida a `specs/done/S1-03-onboarding-crear-empresa.md` (`implemented`). BACKLOG S1-03
  → `done`. Sesión (j) archivada en `docs/archive/sessions-2026-07.md` (cupo de ~5 sesiones
  vigentes).

**Pendiente:**
- Humano: commitear (mensaje sugerido:
  `feat(S1-03): onboarding — RPC create_tenant_with_owner atómica, action con Zod y flujo real de /onboarding`).
- Siguen pendientes: nota de `GRANT` explícito en la plantilla de `supabase-miel` (antes de
  S2-01) y validación estética humana claro/oscuro (sin hacer aún en ninguna página `(auth)`
  ni en `/onboarding`).

**Bloqueos:** ninguno.

**Siguiente paso:** S1-04 (layout de app + selector de empresa + tenant activo) queda
desbloqueada; su spec (`specs/S1-04-layout-tenant-activo.md`) sigue en `estado: draft` — el
humano debe aprobarla antes de implementar. S1-04 reemplaza el destino provisional
`/onboarding` fijado en esta sesión por la app real.

---

## Sesión 2026-07-19 (n) · S1-02 implementada — auth email+password (TDD)

**Alcance:** el humano aprobó la spec `S1-02` al inicio de la sesión (autorizó el cambio de
front-matter draft → approved) y se implementó completa con TDD.

**Hecho:**
- TDD real: `src/lib/validation/{auth,safe-redirect}.test.ts` escritos primero y verificados
  en rojo; luego `auth.ts` (schemas Zod, mensajes en español) y `safe-redirect.ts`
  (`safeNext`, anti open redirect) — 16 tests Vitest en verde.
- Sesión SSR: fábricas `src/lib/supabase/{server,client}.ts` y `src/proxy.ts` — **en Next 16
  la convención `middleware.ts` se renombró a `proxy.ts`** (verificado en
  `node_modules/next/dist/docs`); refresco con `getUser()`, anónimo en ruta protegida →
  `/login?next=`, autenticado en `(auth)` → `/onboarding`. `/reset-password` se trata como
  ruta protegida y exenta del rebote (el enlace de recuperación deja sesión activa; sin esa
  excepción el criterio 4 es imposible) — supuesto anotado en el historial de la spec.
- `src/actions/auth.ts`: signup, login, logout, requestPasswordReset, updatePassword —
  Zod antes de Supabase, errores genéricos sin enumeración de usuarios, `redirect()` fuera
  de try/catch. Callback `src/app/auth/callback/route.ts` (`exchangeCodeForSession`; código
  inválido → `/forgot-password?error=link-invalido`).
- UI grupo `(auth)`: login, signup, forgot-password, reset-password (Card + form cliente con
  `useActionState`, pending en botón, error inline `role=alert`) + stub `/onboarding` con
  logout. shadcn `input/label/card` agregados. Solo tokens de `miel-design`.
- Headers de seguridad en `next.config.ts`: CSP (con `unsafe-eval` solo en dev;
  `unsafe-inline` en script-src queda hasta endurecer con nonces en S9-04),
  `frame-ancestors 'none'`, Referrer-Policy, nosniff.
- `supabase/config.toml`: `additional_redirect_urls` con `http://localhost:3000/**` y
  `http://127.0.0.1:3000/**` — GoTrue rechazaba el `redirectTo` del callback (no estaba en
  la allow-list) y el enlace de recuperación caía a `site_url` roto. `enable_confirmations`
  ya estaba en false. `.env.local` creado con los valores locales de `supabase start`.
- Verificado: lint ✓, tsc ✓, vitest 16/16 ✓, `supabase test db` 9/9 ✓, y el flujo completo
  (criterios 1–4 + `next=//evil.com` + enlace consumido, 11 checks) con navegador real vía
  script Playwright desechable en el scratchpad (no commiteado; e2e formal sigue en S9-01).
- Spec movida a `specs/done/S1-02-auth-email-password.md` (`implemented`); BACKLOG S1-02 →
  `done` (de paso quedó sincronizado el gap spec-ready/draft de la sesión m). Sesiones g, h,
  i archivadas en `docs/archive/sessions-2026-07.md`.

**Pendiente:**
- Humano: commitear (mensaje sugerido:
  `feat(S1-02): autenticación email+password — sesión SSR, actions, callback y headers de seguridad`).
- Siguen pendientes: nota de `GRANT` explícito en la plantilla de `supabase-miel` (antes de
  S2-01) y validación estética humana claro/oscuro (las páginas `(auth)` son las primeras UI).

**Bloqueos:** ninguno.

**Siguiente paso:** el humano aprueba `specs/S1-03-onboarding-crear-empresa.md`; la sesión
siguiente la implementa (RPC `create_tenant_with_owner` con `supabase-miel` + reemplazo del
stub `/onboarding` por el flujo real).

---

## Sesión 2026-07-19 (m) · Revisión pre-aprobación de S1-02 (auth email+password)

**Alcance:** cierre de huecos de la spec `specs/S1-02-auth-email-password.md` antes de la
aprobación humana (solo spec; sin código, sin migraciones).

**Hecho:**
- Con S1-01 en `done`, se identificó S1-02 como siguiente historia de E1, pero su spec
  seguía en `estado: draft` (el BACKLOG decía `spec-ready`; manda el front-matter real —
  gap de sincronía entre ambos, no corregido en caliente por estar fuera de alcance).
- Revisión de la spec contra `docs/arch/seguridad.md`: headers, anti open redirect, errores
  genéricos y validación Zod ya estaban bien alineados. Se detectaron 3 huecos y se
  resolvieron con el humano:
  1. **Destino de redirect post-auth**: S1-03 (onboarding) y S1-04 (grupo `(app)`) no
     existen todavía → se añadió al Alcance un stub `/onboarding` como destino provisional
     (S1-03 lo reemplaza); criterio 1 ajustado en consecuencia.
  2. **Confirmación de email**: para que el criterio 1 ("queda autenticado" tras signup) se
     cumpla sin correo de por medio, se sumó al Alcance `enable_confirmations = false` en
     `supabase/config.toml`.
  3. **Callback handler de recuperación**: el Alcance no nombraba el route handler que
     intercambia el código (`exchangeCodeForSession`) necesario para el criterio 4 — se
     añadió explícito, más un caso borde nuevo (código inválido/consumido en el handler).
- Historial de la spec actualizado con la fecha y el resumen de estos ajustes. Front-matter
  se mantiene en `estado: draft` a propósito — el cambio a `approved` es siempre del humano.

**Bloqueos:** ninguno — solo espera aprobación humana.

---

## Sesión 2026-07-19 (l) · S1-01 implementada — esquema base multitenant (TDD)

**Alcance:** primera historia de código del proyecto. Spec `specs/S1-01-tenants-auth.md`
aprobada por el humano (draft → approved) y luego implementada con TDD estricto.

**Hecho:**
- Entorno local: no había runtime de contenedores (ni Docker Desktop, ni Colima, ni
  OrbStack). Con aprobación del humano se instaló Colima vía Homebrew (`brew install colima
  docker`) y se arrancó (`colima start`). Ajustes de entorno necesarios (fuera del repo):
  `~/.docker/config.json` tenía `credsStore: "desktop"` apuntando a un helper de Docker
  Desktop inexistente — se quitó para permitir `docker pull`.
- `supabase/config.toml`: `[analytics] enabled` pasó de `true` a `false` — el contenedor
  `supabase_vector` monta el socket Docker del host y esa forma de bind mount no la soporta
  Colima (virtiofs); es incompatibilidad conocida Supabase CLI + Colima, no afecta migraciones
  ni RLS. `imgproxy`/`pooler` quedan igualmente detenidos (no se usan aún).
- TDD real: `supabase/tests/S1-01-aislamiento.sql` escrito primero y verificado en rojo
  (moviendo la migración fuera temporalmente: falla con `relation "public.tenants" does not
  exist`, como se esperaba). Migración `supabase/migrations/20260720004900_tenants-memberships-rls.sql`
  aplicada después: `tenants`, `memberships` (`created_by` default `auth.uid()`), función
  `user_tenant_ids()`, helper nuevo `user_is_tenant_admin(uuid)` (security definer, evita
  recursión de RLS al chequear rol owner/admin desde políticas de `memberships`/`tenants`),
  trigger compartido `set_updated_at()` para reuso futuro, políticas RLS según
  `arch/multitenancy-rls.md` (sin insert/delete en `tenants`, ADR-019).
- **Hallazgo de brecha:** los roles `authenticated`/`service_role` NO tienen privilegios de
  tabla (`select`/`insert`/`update`/`delete`) por defecto en este proyecto — solo
  `truncate`/`references`/`trigger`. RLS filtra filas pero no sustituye el `GRANT`; sin él,
  toda consulta falla con "permission denied" aunque la política exista. Se agregó
  `grant select, update on tenants` y `grant select, insert, update, delete on memberships`
  a `authenticated, service_role` en la migración de S1-01. Nota resuelta en la sesión (q,
  2026-07-20): ADR-021 activó el expose automático de tablas en el proyecto Supabase, que
  hace innecesario el `GRANT` manual por migración de ahí en adelante.
- Verificado: `supabase db reset` limpio; `supabase test db` 9/9 verde (guardián +
  aislamiento S1-01); tipos regenerados (`src/lib/database.types.ts`); `npm run lint`,
  `npx tsc --noEmit`, `npm test` limpios.
- Spec movida a `specs/done/S1-01-tenants-auth.md` (`estado: implemented`). BACKLOG:
  S1-01 `spec-ready` → `done`.

**Bloqueos:** ninguno.

---

## Sesión 2026-07-19 (k) · Gobernanza de seguridad verificable — TEMPLATE, GOVERNANCE y retrofit de specs S1

**Alcance:** cierre de huecos de gobernanza del ADR-020 (solo docs y specs; sin código).

**Hecho:**
- Auditoría del enganche del estándar de seguridad: AGENTS.md y CI ya garantizaban la
  verificación, pero tres puntos dependían de memoria y no de proceso.
- `specs/TEMPLATE.md`: sección obligatoria "Consideraciones de seguridad" (entre Casos
  borde y Plan de tests) — el gate manual existente (aprobación humana de la spec) ahora
  verifica seguridad historia por historia.
- Retrofit de las 5 specs de Sprint 1 con esa sección + historial. S1-02 fue la sustantiva:
  headers de seguridad (CSP, frame-ancestors, Referrer-Policy, nosniff) entran a su
  alcance; `next=` validado como ruta relativa interna (anti open redirect) con caso borde
  y test Vitest nuevos (safe-redirect.test.ts).
- `docs/GOVERNANCE.md` §Gates de CI: agregados npm audit y gitleaks (quedó espejo del
  pipeline real).
- Verificado: sección presente en TEMPLATE + 5 specs (grep), lint ✓, tsc ✓, vitest ✓.

**Pendiente (al cierre de esta sesión):**
- Humano: commitear (mensaje sugerido:
  `docs: gobernanza de seguridad verificable — gates en GOVERNANCE, sección en TEMPLATE y retrofit de specs S1`).
- Siguen pendientes anteriores: commit de sesión j, commits b–i y validación estética.

**Bloqueos:** ninguno.

**Siguiente paso:** el humano aprueba las specs de Sprint 1 (ya con consideraciones de
seguridad) y la siguiente sesión implementa S1-01 con TDD (`supabase-miel`).

---

## Sesión 2026-07-19 · Sprint 0 — Arnés de ingeniería

**Hecho:**
- Gobernanza completa: AGENTS.md (reglas + protocolo de sesión), GOVERNANCE.md (SDD+TDD),
  DECISIONS.md (ADR-001…006), wiki atómica con INDEX.md (arch/: stack, multitenancy-rls,
  patron-rpc, convenciones-sql; data-model.md).
- Backlog completo del MVP (BACKLOG.md: 21 historias en 6 épicas con dependencias) y SPRINTS.md.
- Plantilla de specs (specs/TEMPLATE.md) y spec de ejemplo S1-01 en `draft`.
- Scaffolding: Next.js 16 + TS + Tailwind 4 + shadcn/ui + zod + @supabase/ssr; Vitest
  configurado (1 test verde); Playwright con smoke placeholder.
- Supabase CLI instalado (brew), `supabase init`, migración baseline, test guardián pgTAP
  (supabase/tests/00-rls-guard.sql), .env.example.
- CI bloqueante (.github/workflows/ci.yml): jobs app (lint+tsc+vitest) y db (migraciones+pgTAP).
- Skill de proyecto `.claude/skills/nextjs-miel/SKILL.md` (convenciones Next.js del repo).
- Verificado: lint ✓, typecheck ✓, vitest ✓, `npm run dev` responde 200 ✓.

**Pendiente:**
- ⚠️ Docker no estaba corriendo: `supabase start` + `supabase test db` NO se ejecutaron en
  local. Primera acción de la próxima sesión: arrancar Docker y correr ambos para validar
  la migración baseline y el test guardián antes de tocar S1-01.
- Crear repo remoto en GitHub y hacer push (el CI corre allí).

**Bloqueos:** ninguno.

**Siguiente paso:**
1. Humano: revisar y aprobar `specs/S1-01-tenants-auth.md` (está en `draft`).
2. Sesión siguiente: validar pgTAP local (ver Pendiente) e implementar S1-01 con TDD.

---

## Sesión 2026-07-19 (b) · Skill miel-design + identidad visual

**Alcance:** infraestructura de diseño (fuera de historias de backlog; no toca lógica de `src/`).

**Hecho:**
- Skill de proyecto `.claude/skills/miel-design/SKILL.md`: design system y criterio de UI
  premium (tokens como fuente de verdad, layout/espaciado, reglas shadcn, 4 estados
  obligatorios por vista, motion sutil, dark mode + a11y, checklist de salida).
- Identidad visual aplicada en `src/app/globals.css`: neutrales cálidos + acento ámbar/miel
  en oklch, bloques `:root` y `.dark` completos (charts y sidebar incluidos).
- ADR-008 en DECISIONS.md. AGENTS.md (paso 5) y CLAUDE.md ahora exigen `miel-design` al
  tocar UI.
- Fix: `--font-sans` en `globals.css` era auto-referencial (la app renderizaba en Times);
  ahora apunta a `--font-geist-sans` del layout.
- `src/app/page.tsx`: boilerplate de create-next-app (colores hardcodeados) reemplazado por
  placeholder 100% con tokens (vitrina de la identidad). Metadata "Miel" + `lang="es"` en
  layout. `src/components/theme-toggle.tsx`: toggle mínimo de clase `.dark` sin persistencia
  (temporal, para validar dark mode; decidir next-themes o similar en la historia de UI real).
- Verificado: lint ✓, tsc ✓, vitest ✓.

**Pendiente:**
- Validación estética humana: revisar la app en claro/oscuro con los nuevos tokens y ajustar
  valores oklch si la dirección no convence (solo tocar `globals.css`).
- Siguen pendientes de la sesión anterior: Docker + `supabase test db`, y push a GitHub.

**Bloqueos:** ninguno.

**Siguiente paso:** el de la sesión anterior sigue vigente (aprobar spec S1-01, validar pgTAP
local, implementar S1-01 con TDD — ahora aplicando también `miel-design` en su UI).

---

## Sesión 2026-07-19 (c) · Auditoría del arnés — skill supabase-miel y regla de git

**Alcance:** cierre de brechas del arnés (sin código de historia).

**Hecho:**
- Auditoría completa del arnés (wiki, specs, CI, migraciones, skills). Conclusión: el modelo
  de datos NO necesita skill (ya es wiki); la brecha real era el CÓMO de la capa de datos.
- Nuevo skill `.claude/skills/supabase-miel/SKILL.md`: flujo por historia con BD y plantillas
  completas (migración con RLS, test pgTAP de aislamiento con JWT simulado, tests de RPC:
  feliz + invariantes + atomicidad + tenant ajeno). ADR-009.
- Cableado: AGENTS.md paso 6 y CLAUDE.md exigen `supabase-miel` al tocar `supabase/`;
  INDEX.md ahora registra los 4 skills de proyecto.
- Nueva regla en AGENTS.md/CLAUDE.md: **el agente jamás hace `git commit` ni `git push`** —
  siempre el humano. El agente deja verificado y sugiere el mensaje.
- Corregido pendiente obsoleto: el repo remoto YA existe y el CI ya corrió en verde
  (incluido el job db con el guardián pgTAP) — validar pgTAP local con Docker pasa a
  nice-to-have, deja de ser bloqueante.
- Verificado: lint ✓, typecheck ✓, vitest ✓.
- Interoperabilidad de skills (ADR-010): contenido verificado como agnóstico; symlink
  versionado `.agents/skills → ../.claude/skills` para auto-descubrimiento por clientes del
  estándar Agent Skills (Codex, etc.); nota aclaratoria en AGENTS.md para agentes sin
  soporte de skills.

**Pendiente:**
- Humano: commitear y pushear el trabajo acumulado de las sesiones b y c. Mensajes sugeridos:
  `feat: skill miel-design e identidad visual ámbar/miel` y
  `chore: skill supabase-miel y cierre de brechas del arnés`.
- Validación estética en claro/oscuro por el humano (pendiente de la sesión b): aprobada la
  dirección general; ajustes de tono solo en `globals.css` si surgen.

**Bloqueos:** ninguno.

**Siguiente paso:** humano aprueba `specs/S1-01-tenants-auth.md`; la sesión siguiente
implementa S1-01 con TDD aplicando `supabase-miel` + `nextjs-miel` + `ponytail`.

## Sesión 2026-07-19 (d) · Rediseño del modelo de datos — ventas, producción y contabilidad derivada

**Alcance:** diseño de arquitectura de datos (solo documentación; sin código ni migraciones).

**Hecho:**
- Diálogo con el fundador sobre el ciclo real del negocio: comprar materias primas/insumos →
  procesar → vender a clientes (CRM) → medir ganancias. Cuatro decisiones tomadas y
  registradas como ADR-011…014: ventas+clientes entran al MVP; costeo a promedio ponderado
  (con `stock_movements` como Kardex y vista `kardex`); producción con transformación libre +
  recetas opcionales; contabilidad derivada de operaciones (sin partida doble).
- `data-model.md` reescrito: nuevos módulos Clientes y Ventas (customers, sales, sale_items,
  customer_payments), Producción (recipe_items, productions, production_items), Gastos y
  contabilidad (expenses + vistas monthly_pnl, cash_flow, product_profitability); `products`
  gana `kind` y `price`; `payments` → `supplier_payments`; regla de costo congelado en salidas.
- `BACKLOG.md` reorganizado en 9 épicas (E5 ventas · E6 producción · E7 finanzas · E8 dashboard
  · E9 hardening); `SPRINTS.md` con sprints 0–9 y grafo actualizado; `patron-rpc.md` con las
  3 RPCs nuevas (`confirm_sale`, `register_customer_payment`, `register_production`).
- Verificado: lint ✓, tsc ✓, vitest ✓.

**Pendiente:**
- Humano: commitear (mensaje sugerido:
  `docs: rediseño del modelo de datos — ventas, producción y contabilidad derivada`).
- Siguen pendientes de sesiones anteriores: commit/push de sesiones b y c, y validación
  estética claro/oscuro.

**Bloqueos:** ninguno.

**Siguiente paso:** sin cambio — humano aprueba `specs/S1-01-tenants-auth.md` (el rediseño no
toca la fundación multitenant); la sesión siguiente implementa S1-01 con TDD.

## Sesión 2026-07-19 (e) · Caso SIDERAL — despacho, postventa y automatización en Fase 2

**Alcance:** validación del modelo de datos contra caso real y cierre de brechas (solo docs).

**Hecho:**
- Modelo validado contra el caso SIDERAL (miel de abejas): compras multi-proveedor, insumos
  de producción y CRM de quién compra más/menos ya estaban cubiertos.
- Brechas cerradas (ADR-015): `sales` gana estados shipped/delivered + shipping_address/
  shipped_at/delivered_at (sin tabla shipments; despachada no se cancela); nueva tabla
  `customer_interactions` (note/followup/complaint/promo) para postventa.
- BACKLOG: historias nuevas S5-06 (despacho) y S5-07 (interacciones postventa); e2e S9-01
  llega hasta despacho; seeds S9-02 incluyen interacciones. SPRINTS actualizado.
- Fase 2 ampliada (data-model + BACKLOG): automatización de pedidos/mensajería (canal externo
  sobre las mismas RPCs), devoluciones de venta, activos fijos/depreciación (equipos como
  marcos y alzas van como `expenses` en el MVP).
- Verificado: lint ✓, tsc ✓, vitest ✓.

**Pendiente:**
- Humano: commitear (mensaje sugerido:
  `docs: caso SIDERAL — despacho, postventa y automatización en Fase 2`).
- Siguen pendientes anteriores: commits de sesiones b–d y validación estética claro/oscuro.

**Bloqueos:** ninguno.

**Siguiente paso:** sin cambio — humano aprueba `specs/S1-01-tenants-auth.md`; la sesión
siguiente implementa S1-01 con TDD.

## Sesión 2026-07-19 (f) · Gastos fijos/variables y página Finanzas con analítica gráfica

**Alcance:** validación del modelo de gastos y cierre de brechas (solo docs).

**Hecho:**
- Pregunta del fundador: ¿el modelo cubre gastos fijos y variables con estadísticas gráficas
  para detectar fugas? Diagnóstico: registro y P&L sí; clasificación fijo/variable, pantalla
  de análisis y recurrentes, no.
- Cerrado (ADR-016): `expenses.kind ('fixed'|'variable')` obligatorio; nueva vista
  `monthly_expenses` (mes × categoría × kind); nueva historia S7-03 — página **Finanzas**
  con gráficas (evolución por categoría, fijo vs variable, % sobre ingresos, comparativa
  mensual; `miel-design` + skill `dataviz`). El dashboard S8-01 queda liviano: tarjetas
  resumen + enlace a Finanzas.
- Fase 2 ampliada: gastos recurrentes y presupuestos (fijos esperados con detección de
  anomalías).
- Verificado: lint ✓, tsc ✓, vitest ✓.

**Pendiente:**
- Humano: commitear (mensaje sugerido:
  `docs: gastos fijos/variables y página de finanzas con analítica gráfica`).
- Siguen pendientes anteriores: commits de sesiones b–e y validación estética claro/oscuro.

**Bloqueos:** ninguno.

**Siguiente paso:** sin cambio — humano aprueba `specs/S1-01-tenants-auth.md`; la sesión
siguiente implementa S1-01 con TDD.

## Sesión 2026-07-19 (g) · POS completo — caja, venta en un paso, consecutivo y descuentos

**Alcance:** validación del feature POS contra buenas prácticas y cierre de brechas (solo docs).

**Hecho:**
- Diagnóstico: el módulo de ventas era back-office; para POS faltaban caja/arqueo, venta en
  un paso, consecutivo de recibo y descuentos trazables.
- Cerrado (ADR-017): tabla `cash_sessions` + RPCs `open_cash_session`/`close_cash_session`
  (una sesión abierta por usuario; cierre con esperado y diferencia); RPC `register_pos_sale`
  atómica (ítems + descuentos + consecutivo + stock + pagos mixtos + sesión);
  `sales.receipt_number` y `sales.cash_session_id`; `sale_items.discount` (por ítem, precio
  de lista intacto); `customer_payments.cash_session_id`; vista `cash_session_summary`.
- BACKLOG: E5 renombrada "Clientes, ventas y POS" con historias nuevas S5-08 (descuentos +
  consecutivo), S5-09 (caja/arqueo), S5-10 (pantalla POS). Reporte de descuentos sumado a
  S7-03 (Finanzas). SPRINTS y patron-rpc actualizados.
- Verificado: lint ✓, tsc ✓, vitest ✓.

**Pendiente:** commit del humano (`docs: POS completo — sesiones de caja, venta en un paso, consecutivo y descuentos`).

**Bloqueos:** ninguno.

## Sesión 2026-07-19 (h) · Auditoría integral — permisos, auditoría, diagrama ER y SDD Sprint 1

**Alcance:** auditoría pre-desarrollo del arnés completo y cierre de brechas de arquitectura
(solo docs y specs; sin código ni migraciones).

**Hecho:**
- Auditoría integral: gobernanza y modelo de datos sólidos; brechas detectadas y cerradas
  (ADR-018): sin matriz de permisos, sin autoría, sin visión ER, supuestos sin documentar,
  specs faltantes del Sprint 1.
- Nueva wiki `arch/permisos-roles.md`: matriz rol × módulo — principio "member opera, no ve
  finanzas"; materialización en RLS + UI. Nueva wiki `arch/diagrama-er.md`: ER mermaid de
  conjunto. Ambas registradas en INDEX.md.
- Convención `created_by uuid default auth.uid()` en toda tabla de negocio + `updated_at`
  con trigger en editables + reportes mensuales en TZ 'America/Bogota'
  (convenciones-sql.md). Supuestos en data-model.md (TZ, unidades sin conversión, sin
  Storage). Tabla `invitations` agregada al modelo.
- SDD Sprint 1 completo en `draft` listo para aprobación: S1-01 actualizada + S1-02 auth +
  S1-03 onboarding + S1-04 layout/tenant activo + S1-05 invitaciones. BACKLOG: E1 en `spec-ready`.
- Verificado: lint ✓, tsc ✓, vitest ✓.

**Pendiente:** commit del humano (`docs: auditoría integral — permisos, auditoría created_by, diagrama ER y SDD del Sprint 1`).

**Bloqueos:** ninguno.

## Sesión 2026-07-19 (i) · ADR-019 — eliminar tenant pasa a operación de plataforma

**Alcance:** ajuste de gobernanza de permisos (solo docs y spec S1-01, aún en draft).

**Hecho:**
- Decisión del fundador: ningún rol de la app elimina tenants; es operación de plataforma
  fuera de banda con `service_role`. Registrada como ADR-019 (supersede parcialmente ADR-018).
- Matriz `arch/permisos-roles.md`: fila dividida — "Facturación del SaaS" sigue en owner;
  "Eliminar el tenant" pasa a ✖/✖/✖ (solo plataforma). Nota en Materialización: `tenants`
  sin política de delete.
- Spec S1-01 (draft): política de `tenants` sin delete referenciando ADR-019, criterio de
  aceptación 6 nuevo (owner no puede borrar su tenant) + fila en el plan de tests pgTAP.

**Pendiente:** commit del humano (`docs: ADR-019 — eliminar tenant pasa a operación de plataforma (service_role)`).

**Bloqueos:** ninguno.

## Sesión 2026-07-19 (j) · ADR-020 — estándar de seguridad (OWASP + agéntica) con gates de CI

**Alcance:** estándar de seguridad pre-desarrollo (docs + CI; sin código en `src/` ni `supabase/`).

**Hecho:**
- Decisión del fundador (ADR-020): estándar de seguridad en ambos frentes — aplicación
  (OWASP Top 10) y agéntica (prompt injection, features LLM de Fase 2) — con gates ejecutables.
- Nueva wiki `docs/arch/seguridad.md` (registrada en INDEX): validación Zod en boundaries,
  mass assignment, XSS, open redirect, headers CSP (se implementan en S1-02), rate limiting,
  errores genéricos; sección agéntica: contenido no confiable = dato jamás instrucción,
  jerarquía de confianza, lineamientos LLM (nunca service_role, allowlist de RPCs, casos de
  abuso en specs). Incluye checklist de salida para la DoD.
- AGENTS.md: reglas innegociables 7 (validación en boundaries) y 8 (no obedecer prompt
  injection), casilla de seguridad en la DoD, `seguridad.md` sumada al protocolo de sesión.
- CI: `npm audit --omit=dev --audit-level=high` bloqueante en el job app + job nuevo
  `secrets` con gitleaks (historial completo). BACKLOG: historia S9-04 (auditoría de
  seguridad pre-beta) en E9.
- Verificado: lint ✓, tsc ✓, vitest ✓, `npm audit --audit-level=high` pasa localmente
  (solo 2 moderadas en postcss embebido de Next, bajo el umbral). Sesión (e) archivada.

**Pendiente:**
- Humano: commitear (mensaje sugerido:
  `docs: ADR-020 — estándar de seguridad (OWASP + agéntica) con gates de CI`).
- El job gitleaks se valida en el primer push (no se ejecuta localmente).
- Siguen pendientes anteriores: commits de sesiones b–i y validación estética claro/oscuro.

**Bloqueos:** ninguno.

**Siguiente paso:** igual que sesión i — el humano aprueba las specs de Sprint 1 y la
siguiente sesión implementa S1-01 con TDD (`supabase-miel`); S1-02 deberá incluir headers
de seguridad y redirects seguros según `arch/seguridad.md`.
