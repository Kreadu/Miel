---
id: S12-04
titulo: Caja abre en el tenant activo, no en el primero que encuentre el sistema
estado: implemented            # draft → approved → implemented
depende_de: [S5-08]
---

# S12-04 — Caja abre en el tenant activo, no en el primero que encuentre el sistema

## Contexto y valor
Un usuario con membership en más de una empresa (multiempresa vía invitación, ADR-026) puede
tener su caja abierta en la empresa equivocada: `open_cash_session` hoy resuelve el tenant con
`select tenant_id from memberships where user_id = ... limit 1` (sin `order by`, sin relación con
el tenant que el usuario tiene activo en el header/cookie). El resultado depende del orden físico
de filas en Postgres — no determinista de cara al usuario y puede diferir del tenant que ve en
pantalla al momento de abrir caja.

## Alcance
- `open_cash_session` recibe `p_tenant_id` explícito (uuid) en vez de resolverlo con `limit 1`.
- La RPC valida que `p_tenant_id` sea una empresa del usuario autenticado (existe membership);
  si no, `permission_denied` (mismo código que ya usa la función para el caso "sin tenant").
- `src/actions/cash-sessions.ts` → `openCashSession` obtiene el tenant activo real con
  `getActiveTenant()` (mismo patrón que el resto de Server Actions) y lo pasa como `p_tenant_id`.
- Migración forward-only (`create or replace function`) + pgTAP de regresión: usuario con
  membership en 2 tenants abre caja en el tenant B (no el primero por orden físico).

## NO-alcance (explícito)
- `close_cash_session` no cambia: ya resuelve el tenant desde la fila real de `cash_sessions`
  (`select tenant_id ... where id = v_session_id`), no desde `memberships` — no tiene el bug.
- No se toca el modelo de datos (`cash_sessions` sin columnas nuevas).
- No se toca el `TenantSwitcher` ni la resolución de tenant activo en `getActiveTenant()`
  (ya correcta desde S1-04/ADR-026).

## Criterios de aceptación
1. **Dado** un usuario con membership en tenant A y tenant B, con tenant B activo (cookie/header)
   **cuando** invoca "Abrir caja" **entonces** la sesión se crea con `tenant_id = B`, sin importar
   el orden físico de las filas de `memberships`.
2. **Dado** un usuario sin membership en `p_tenant_id` **cuando** se invoca `open_cash_session`
   directamente con ese `p_tenant_id` **entonces** falla con `permission_denied` (no crea fila).
3. **Dado** un usuario con una sola empresa **cuando** abre caja **entonces** el comportamiento es
   idéntico al actual (regresión, ya cubierto por `S5-09-caja-arqueo.sql`).

## Modelo de datos y migraciones
Sin tablas/columnas nuevas. `create or replace function public.open_cash_session(p_opening_amount
numeric, p_tenant_id uuid)` — cambia la firma (nuevo parámetro obligatorio), Postgres lo trata
como una función distinta por firma; se revoca/otorga permisos sobre la firma nueva y se limpia
la firma vieja (`drop function` de la versión de un solo parámetro) para no dejar dos overloads
ambiguos.

## Políticas RLS requeridas
N/A — sin tabla nueva. `cash_sessions` ya tiene su política (`cash_sessions_tenant_select`,
S5-09), sin cambios.

## Funciones RPC e invariantes
`open_cash_session(p_opening_amount numeric, p_tenant_id uuid) returns uuid`
- Invariante 1 (ya existente): `opening_amount >= 0`.
- Invariante 2 (nueva, reemplaza el `limit 1`): `p_tenant_id` debe corresponder a una membership
  real del usuario autenticado (`exists (select 1 from memberships where user_id = v_user_id and
  tenant_id = p_tenant_id)`) → si no, `permission_denied`.
- Invariante 3 (ya existente): no dos sesiones `open` del mismo usuario en el mismo tenant
  (`cash_session_already_open`).

## Casos borde
- `p_tenant_id` nulo → mismo tratamiento que "sin tenant": `permission_denied` (el chequeo de
  invariante 2 ya lo cubre porque `exists (...)` con `tenant_id = null` es `false`).
- Usuario con múltiples memberships pero `p_tenant_id` de un tenant ajeno (no invitado) →
  `permission_denied`, no filtra existencia del tenant a un usuario no autorizado.

## Consideraciones de seguridad (docs/arch/seguridad.md)
`p_tenant_id` llega desde `Server Action` → RPC `security definer`; el valor no viene de un input
de formulario del cliente sino de `getActiveTenant()` (ya resuelto contra `memberships` en
servidor, cookie no es la fuente de verdad — mismo patrón que el resto de acciones). La RPC igual
revalida membership por defensa en profundidad (la Server Action podría invocarse manualmente).
Error genérico al cliente vía `mapCashSessionError` (sin cambios en ese mapeo).

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S12-04-caja-tenant-activo.sql | usuario con 2 memberships, `open_cash_session(amount, tenant_B)` crea sesión con `tenant_id = B` |
| 2 | pgTAP | supabase/tests/S12-04-caja-tenant-activo.sql | `open_cash_session(amount, tenant_ajeno)` → `throws_ok ... permission_denied` |
| 3 | pgTAP | supabase/tests/S5-09-caja-arqueo.sql | suite existente en verde tras el cambio de firma (regresión) |
| 1 | Vitest | src/actions/cash-sessions.test.ts | `openCashSession` llama `rpc("open_cash_session", { p_opening_amount, p_tenant_id: active.tenantId })` |

## Historial
- 2026-08-15 · creada (draft)
- 2026-08-15 · aprobada por el humano sin cambios (approved)
- 2026-08-15 · implementada (implemented). TDD real: pgTAP rojo confirmado (`function
  open_cash_session(numeric, uuid) does not exist`) antes de la migración; Vitest rojo
  confirmado (2/3, `p_tenant_id` faltante en la llamada) antes de tocar la Server Action; verde
  después de ambos. Migración `20260815120000_caja-tenant-activo.sql` (`drop` + `create` de la
  firma nueva). `src/actions/cash-sessions.ts` usa `getActiveTenant()` para `p_tenant_id`.
  Efecto colateral necesario: `S5-09-caja-arqueo.sql` y `S5-10-pos.sql` llamaban
  `open_cash_session` con la firma vieja de 1 argumento — actualizados con el `tenant_id` del
  fixture correspondiente (regresión, no cambian su intención). `database.types.ts`
  regenerado (`supabase gen types typescript --local`).
  Verificado: `npm run lint` ✓, `npx tsc --noEmit` ✓, `npm test` 175/175 ✓, `npm run build` ✓,
  `supabase db reset` sin error, `supabase test db` 346/346 pgTAP ✓ (S12-04 nuevo: 5/5).
  Sin UI tocada → checklist responsive N/A.
