---
id: S1-01
titulo: Esquema base multitenant (tenants, memberships, RLS)
estado: implemented
depende_de: []
---

# S1-01 — Esquema base multitenant

## Contexto y valor
Todo el ERP se apoya en el aislamiento por empresa. Esta historia crea el cimiento:
tablas `tenants` y `memberships`, la función `user_tenant_ids()` y el patrón RLS que
toda tabla futura reutilizará. Sin esto no puede construirse ningún módulo.

## Alcance
- Migración con `tenants`, `memberships`, función `user_tenant_ids()` y políticas RLS.
- Test guardián `00-rls-guard.sql` verificado contra estas primeras tablas reales.
- Test pgTAP de aislamiento entre dos tenants.

## NO-alcance (explícito)
- UI de ningún tipo (signup/onboarding son S1-02/S1-03).
- Invitaciones y gestión de roles (S1-05).
- Ninguna tabla de negocio (inventario, compras…).

## Criterios de aceptación
1. **Dado** un esquema limpio **cuando** se aplican las migraciones **entonces** existen `tenants` y `memberships` con RLS habilitado y políticas según el patrón de `docs/arch/multitenancy-rls.md`.
2. **Dado** un usuario con membership en el tenant A **cuando** consulta `tenants` o `memberships` **entonces** solo ve filas de A (0 filas del tenant B) — probado en pgTAP simulando JWT.
3. **Dado** un usuario autenticado sin membership **cuando** consulta cualquiera de las dos tablas **entonces** ve 0 filas.
4. **Dado** un usuario `member` del tenant A **cuando** intenta insertar una membership en A o en B **entonces** la operación es rechazada (solo `owner`/`admin` de A gestionan memberships de A).
5. **Dado** el test guardián **cuando** corre `supabase test db` **entonces** confirma RLS + ≥1 política en toda tabla de `public`.
6. **Dado** el `owner` del tenant A **cuando** intenta `delete from tenants` sobre A **entonces** RLS lo rechaza (0 filas afectadas) — la eliminación de tenants es solo de plataforma (ADR-019).

## Modelo de datos y migraciones
Según `docs/data-model.md` (sección Multitenancy) y convenciones de `docs/arch/convenciones-sql.md`:
`tenants(id, name, nit, currency default 'COP', created_at)`;
`memberships(id, user_id → auth.users, tenant_id → tenants, role check in ('owner','admin','member'), unique(user_id, tenant_id), created_by default auth.uid(), created_at)`.
Índices en `memberships(user_id)` y `memberships(tenant_id)`.
Nota: `tenants` no lleva `created_by` (el creador queda como membership owner vía la RPC de
S1-03); la excepción a la convención de ADR-018 se limita a esta tabla raíz. Además, esta
migración crea el trigger compartido de `updated_at` (convenciones-sql.md) para reuso futuro.

## Políticas RLS requeridas
Según la matriz de `docs/arch/permisos-roles.md`:
- `tenants`: select para miembros; update solo `owner`/`admin`; sin política de delete —
  nunca desde la app: la eliminación es operación de plataforma con `service_role` (ADR-019).
- `memberships`: select para miembros del tenant; insert/update/delete solo `owner`/`admin`
  del tenant. La creación del PRIMER owner se hará vía RPC en S1-03 (fuera de alcance aquí,
  pero la política no debe impedir ese diseño).
- Función `user_tenant_ids()` según patrón documentado (security definer, stable).

## Funciones RPC e invariantes
N/A en esta historia (la RPC de onboarding es S1-03).

## Casos borde
- Usuario con memberships en 2 tenants: ve ambos tenants, y solo esos.
- Rol fuera del check constraint → rechazo.
- Mismo usuario dos veces en el mismo tenant → rechazo por unique.

## Consideraciones de seguridad (docs/arch/seguridad.md)
N/A en la capa app (historia solo de BD). La seguridad de esta historia ES su contenido:
RLS como única frontera (ADR-002), aislamiento probado en pgTAP y test guardián en CI.
Sin política de delete en `tenants` (ADR-019).

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 5 | pgTAP | supabase/tests/00-rls-guard.sql | RLS + política en toda tabla public |
| 2, 3 | pgTAP | supabase/tests/S1-01-aislamiento.sql | visibilidad cruzada = 0; sin membership = 0 |
| 4 | pgTAP | supabase/tests/S1-01-aislamiento.sql | member no gestiona memberships |
| 6 | pgTAP | supabase/tests/S1-01-aislamiento.sql | owner no puede borrar su tenant (0 filas) |

## Historial
- 2026-07-19 · creada (draft) como spec de ejemplo del arnés — pendiente de aprobación humana.
- 2026-07-19 · actualizada tras auditoría integral (ADR-018): `created_by` en memberships,
  trigger compartido de `updated_at`, referencia a la matriz `arch/permisos-roles.md`.
- 2026-07-19 · ADR-019: eliminar tenant deja de ser permiso de `owner` — sin política de
  delete en `tenants`; nuevo criterio 6 y test pgTAP negativo.
- 2026-07-19 · ADR-020: sección "Consideraciones de seguridad" agregada (retrofit del
  estándar de seguridad).
- 2026-07-19 · aprobada por el humano — habilita implementación TDD.
- 2026-07-19 · implementada: migración `20260720004900_tenants-memberships-rls.sql`
  (tenants, memberships, `user_tenant_ids()`, helper `user_is_tenant_admin()` para evitar
  recursión de RLS, grants de tabla); test `supabase/tests/S1-01-aislamiento.sql` (7 casos,
  criterios 2/3/4/6); guardián `00-rls-guard.sql` en verde (criterios 1/5). `supabase test db`
  9/9 verde. Tipos regenerados, lint/tsc/vitest limpios. Movida a `specs/done/`.
