---
id: S1-05
titulo: Invitaciones de usuarios con rol
estado: implemented
depende_de: [S1-04]
---

# S1-05 — Invitaciones con rol

## Contexto y valor
Una empresa es un equipo: el owner necesita sumar a su contador (admin) y a sus operarios
(member). Esta historia crea el mecanismo de invitación por email con rol, cerrando la
épica de fundación: desde aquí, todo el trabajo es multi-usuario.

## Alcance
- Tabla `invitations` + RLS (solo owner/admin del tenant la gestionan).
- Página de equipo en `/(app)/equipo`: listar miembros e invitaciones pendientes, crear
  invitación (email + rol admin|member), revocar invitación pendiente. Se suma "Equipo" a
  `NAV_ITEMS` (`src/lib/tenant/nav-visibility.ts`, S1-04), visible solo para owner/admin
  (coherente con la fila "Invitar usuarios" de `permisos-roles.md`) — `member` no ve el
  enlace ni puede resolver la ruta (RLS de `invitations` la bloquea igual si la fuerza).
  **Miembros se listan solo por rol** (marcando "tú" para el propio usuario), **sin email de
  terceros**: el email de un miembro ya aceptado vive en `auth.users`, fuera del alcance de
  RLS sobre `public`, y traerlo exigiría una pieza de BD nueva no prevista en esta historia
  (decisión con el humano — ver Historial). El email de las invitaciones *pendientes* sí se
  muestra (vive en `invitations`). El detalle de miembros con email queda para la futura
  historia de gestión de equipo (cambiar rol/remover).
- MVP sin envío real de correo: se genera un **enlace de invitación copiable**
  (`/invite/<token>`) que el owner comparte por su canal (WhatsApp, email manual).
- Página pública `/invite/<token>`: si no hay sesión, redirige a `/signup?next=/invite/<token>`
  (un invitado es por definición un usuario nuevo — signup, no login; el enlace de "ya tengo
  cuenta" del propio formulario de signup sigue disponible si aplica). Con sesión, llama la
  RPC `accept_invitation(p_token)`.
- `next` a través de signup: **ya resuelto por S1-02, cero trabajo nuevo** — verificado en
  código: `signup/page.tsx` lee `searchParams.next` → `SignupForm` lo reenvía como campo
  oculto → la Server Action `signup` (`src/actions/auth.ts:32`) redirige con
  `safeNext(formData.get("next"))`. `/invite/<token>?` llega como `next` igual que cualquier
  otra ruta protegida.
- Redirect post-aceptación: fija `active_tenant` al tenant recién aceptado reusando
  `setActiveTenant` (`src/actions/tenant.ts`, S1-04) antes de redirigir a `/inicio` — evita
  depender del fallback "primera membership" de `resolveActiveTenant` cuando el usuario ya
  tenía otras empresas.
- RPC `accept_invitation` — `security definer` (justificado en ADR-018: el invitado aún no
  es miembro del tenant).

## NO-alcance (explícito)
- Envío de email transaccional (Fase 2; anotado como supuesto).
- Cambiar rol o remover miembros existentes (historia futura de gestión de equipo).
- Invitar como `owner` (solo admin|member; transferencia de ownership es Fase 2).

## Criterios de aceptación
1. **Dado** un owner/admin **cuando** crea una invitación con email y rol válidos
   **entonces** queda registrada con token único y expiración (7 días) y obtiene el enlace
   copiable. Un `member` no puede crearla (RLS la rechaza — probado en pgTAP).
2. **Dado** un usuario autenticado cuyo email coincide con una invitación vigente
   **cuando** llama `accept_invitation(token)` **entonces** nace su membership con el rol
   invitado, la invitación queda `accepted_at`, el tenant aparece en su selector y queda
   fijado como `active_tenant` (redirect a `/inicio` ya dentro de ese tenant).
3. **Dado** un token vencido, ya aceptado o revocado **cuando** se intenta aceptar
   **entonces** la RPC rechaza con mensaje claro y no crea membership (probado en pgTAP).
4. **Dado** un usuario autenticado con email DISTINTO al invitado **cuando** intenta aceptar
   **entonces** la RPC rechaza (el token no es transferible — probado en pgTAP).
5. **Dado** un invitado que ya es miembro del tenant **cuando** acepta **entonces** la RPC
   rechaza sin duplicar membership (unique de S1-01 + validación con mensaje claro).

## Modelo de datos y migraciones
Según `docs/data-model.md` (Multitenancy):
`invitations(id, tenant_id → tenants, email text, role check in ('admin','member'),
token unique default gen_random_uuid(), expires_at default now()+interval '7 days',
accepted_at nullable, created_by default auth.uid(), created_at)`.
Índices en `tenant_id` y `token`.

## Políticas RLS requeridas
Según matriz `docs/arch/permisos-roles.md`:
- `invitations`: select/insert/update(revocar)/delete solo para owner/admin del tenant
  (política con subconsulta a `memberships.role`). `member`: sin acceso.
- El invitado NO lee la tabla: la página `/invite/<token>` resuelve todo vía la RPC
  (que valida el token internamente) — sin política pública.

## Funciones RPC e invariantes
`accept_invitation(p_token uuid) returns uuid` (tenant_id), `security definer`:
1. Usuario autenticado; si no → excepción.
2. Token existe, no aceptado, no vencido; si no → excepción con motivo.
3. Email del JWT (`auth.jwt()->>'email'`) = email invitado (case-insensitive); si no → excepción.
4. No existe membership previa de ese usuario en el tenant; si no → excepción.
5. Crea membership con el rol de la invitación + marca `accepted_at`, misma transacción
   (atomicidad probada).

## Casos borde
- Dos invitaciones vigentes al mismo email en el mismo tenant → permitido crear, pero la
  primera aceptada bloquea la segunda por el invariante 4 (queda consumible/revocable).
- Invitación a un email que ya es miembro → la creación se permite (no filtramos por email
  de auth.users desde el cliente), pero aceptar falla con mensaje claro (criterio 5).
- Revocar = delete de la invitación pendiente; una aceptada no se borra (historial).
- Token por URL: tratarlo como secreto — la página nunca lo loguea ni lo reenvía a terceros.
- Invitado sin cuenta abre `/invite/<token>`: `proxy.ts` (S1-04, allow-list de rutas
  públicas) lo rebota a `/signup?next=/invite/<token>` (no `/login`, es usuario nuevo);
  tras signup vuelve a `/invite/<token>` y ahí sí llama la RPC. Si ya tiene cuenta pero no
  sesión, usa el enlace "ya tengo cuenta" del formulario de signup — mismo `next` preservado.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- **El token es dato no confiable y secreto**: un solo uso, expiración de 7 días, validación
  íntegra dentro de la RPC (invariantes 2-4, probados en pgTAP); no transferible (email del
  JWT debe coincidir); la página no lo loguea.
- **Sin enumeración**: los errores de aceptación (vencido/usado/email ajeno) no revelan si
  el email invitado tiene cuenta; mensajes genéricos hacia el cliente.
- **No-escalada**: la RPC `security definer` solo crea la membership del propio
  `auth.uid()` con el rol de la invitación (nunca `owner` — rol fuera del check → rechazo).
- **Validación en el boundary**: Zod en email y rol antes de insertar; columnas explícitas.
- **Redirect post-aceptación**: a ruta interna fija de la app (`/inicio`), nunca a un valor
  del query string.
- **`next` a través de signup**: reusa `safeNext` (S1-02) sin ampliar su contrato — sigue
  aceptando solo rutas relativas internas; `/invite/<token>` cumple ese formato igual que
  cualquier otra ruta protegida.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S1-05-invitaciones.sql | aislamiento + solo owner/admin insertan; member rechazado |
| 2 | pgTAP | supabase/tests/S1-05-invitaciones.sql | caso feliz: membership con rol correcto + accepted_at, atómico |
| 3, 4, 5 | pgTAP | supabase/tests/S1-05-invitaciones.sql | vencido/usado/email ajeno/duplicado → excepción sin efectos |
| 1 | Vitest | src/lib/validation/invitations.test.ts | schema Zod: email y rol válidos |
| 1 | Vitest | src/lib/tenant/nav-visibility.test.ts | "Equipo" visible solo owner/admin |

## Historial
- 2026-07-19 · creada (draft) en la auditoría integral pre-desarrollo — pendiente de aprobación humana.
- 2026-07-19 · ADR-020: sección "Consideraciones de seguridad" agregada (retrofit del
  estándar de seguridad).
- 2026-07-20 · revisión pre-aprobación (draft → spec-ready): cerrados 3 huecos de
  integración con lo construido en S1-04 (patrón de S1-02/S1-03). (1) Ruta de la página de
  equipo fijada a `/(app)/equipo`, sumada a `NAV_ITEMS` visible solo owner/admin. (2)
  `/invite/<token>` sin sesión redirige a `/signup?next=...` (no `/login` — el invitado es
  usuario nuevo por definición); se verificó que el flujo `next` a través de signup ya existe
  desde S1-02 (`signup/page.tsx` → `SignupForm` → `safeNext`), sin trabajo nuevo. (3) El
  redirect post-aceptación fija `active_tenant` al tenant recién aceptado reusando
  `setActiveTenant` de S1-04, en vez de depender del fallback de `resolveActiveTenant`.
  Front-matter draft → spec-ready; pendiente aprobación humana (spec-ready → approved).
- 2026-07-20 · **rectificación**: la nota anterior sobre `GRANT` obsoleto por ADR-021 era
  incorrecta — ADR-021 (expose automático) es config del **proyecto cloud**; verificado que
  las migraciones locales no tienen event trigger de expose/automatic RLS, así que
  `invitations` sí necesita su `GRANT` explícito local (patrón de S1-01), redundante solo en
  cloud. Además, con el humano: al implementar se optó por listar miembros **sin email**
  (opción más simple entre 3 evaluadas — RPC de lectura nueva / miembros sin email / diferir
  la lista completa a otra historia) para no sumar superficie de BD no prevista en la spec;
  anotado en Alcance. Aprobada por el humano (approved) e implementada con TDD en la misma
  sesión.
- 2026-07-20 · implementada (approved → implemented). TDD real: pgTAP
  (`supabase/tests/S1-05-invitaciones.sql`, 13 tests) y Vitest (`invitations.test.ts`)
  escritos primero y verificados en rojo; migración `invitations` + RPC `accept_invitation`
  después, en verde (30/30 pgTAP con guardián + S1-01 + S1-03). **Hallazgo TDD crítico**
  (bug real de S1-04, no de esta historia, pero solo visible con ≥2 miembros por tenant —
  algo que S1-05 introduce por primera vez): `getActiveTenant()`
  (`src/lib/tenant/server.ts`) leía `memberships` sin filtrar `user_id`, asumiendo una fila
  por tenant; pero la política RLS de `memberships` es visible a **todo el equipo** del
  tenant (necesario para que `/equipo` liste compañeros), no solo a la fila propia. Con
  ≥2 miembros, la query devolvía una fila por compañero y `resolveActiveTenant` tomaba la
  primera por `tenant_id` (casi siempre la del owner, creada primero) — un invitado `member`
  terminaba viendo el rol y la navegación de **otro usuario** de su propio tenant. Detectado
  con verificación manual real (Playwright + consulta directa a PostgREST con el token del
  invitado), no por los tests automáticos (ninguno cubría un tenant con 2+ miembros).
  Corregido con `.eq('user_id', user.id)` explícito — exactamente el caso que
  `nextjs-miel` anticipa ("filtro explícito solo cuando la semántica lo requiera"). Sin este
  fix, el criterio 2 de esta historia (tenant activo correcto tras aceptar) era imposible de
  cumplir en la práctica. **Acción pendiente**: sumar un test pgTAP de aislamiento con ≥2
  miembros a `S1-01-aislamiento.sql` o `S1-05-invitaciones.sql` en una futura sesión, para
  que este caso quede cubierto en CI (anotado también en SESSION_LOG).
  Verificado además: lint ✓, tsc ✓, Vitest 35/35 ✓, `supabase test db` 30/30 ✓, y los 5
  criterios de aceptación con navegador real vía script Playwright desechable en el
  scratchpad (12 checks, no commiteado — e2e formal sigue en S9-01): signup+onboarding del
  owner → invitar → invitado sin sesión rebota a `/signup?next=...` (no `/login`) → `next`
  preservado → acepta → `/inicio` con `active_tenant` y rol correctos → `member` no ve
  "Equipo" en el sidebar ni puede resolver `/equipo` (404) → token ya usado rechazado con
  mensaje genérico → invitación ya no aparece como pendiente para el owner. Spec movida a
  `specs/done/`. BACKLOG S1-05 → `done`. Cierra Sprint 1 (E1).
