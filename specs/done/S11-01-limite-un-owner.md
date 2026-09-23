---
id: S11-01
titulo: Límite de una empresa como owner por usuario
estado: implemented
depende_de: [S1-03, S1-05]
---

# S11-01 — Límite de una empresa como owner por usuario

## Contexto y valor
La creación libre de empresas (`+ Crear otra empresa` visible para todos) genera empresas de
prueba/duplicadas y confusión de contexto. Se mantiene el modelo N:M (`memberships`) — correcto y
necesario para invitaciones y el caso del contador multi-empresa — pero se restringe la creación:
un usuario puede ser `owner` de máximo 1 empresa; pertenecer a más empresas solo vía invitación
(roles `admin`/`member`, límite ya vigente en `invitations`). Ver ADR-026.

## Alcance
- Enforcement en BD: `create_tenant_with_owner` rechaza si el usuario ya tiene una membership `owner`.
- `src/actions/onboarding.ts`: mapear el error de negocio (P0001) a su mensaje real.
- `src/app/(app)/layout.tsx`: link `+ Crear otra empresa` visible solo si el usuario no es owner de ninguna empresa.
- `src/app/onboarding/page.tsx`: `?crear` redirige a `/inicio` si el usuario ya es owner.
- ADR-026 en `docs/DECISIONS.md`.

## NO-alcance (explícito)
- Sin migración de datos para usuarios existentes con 2+ empresas propias (regla hacia adelante).
- Sin flag configurable de "máximo de empresas".
- Sin cambios en `memberships`, RLS, helpers, `TenantSwitcher` ni invitaciones.
- Mejora de visibilidad del contexto activo en móvil → historia aparte (S11-02).

## Criterios de aceptación
1. **Dado** un usuario sin membresías **cuando** llama `create_tenant_with_owner` **entonces** crea tenant + membership `owner` (regresión del onboarding).
2. **Dado** un usuario que ya es `owner` de una empresa **cuando** llama `create_tenant_with_owner` **entonces** falla con errcode `P0001` y mensaje "Ya eres owner de una empresa…", sin dejar tenant parcial (atomicidad).
3. **Dado** un usuario que solo es `member`/`admin` por invitación **cuando** llama `create_tenant_with_owner` **entonces** SÍ puede crear su propia empresa.
4. **Dado** un usuario owner **cuando** ve el sidebar o visita `/onboarding?crear` **entonces** no ve el link de crear otra empresa y la página lo redirige a `/inicio`; un usuario sin membership `owner` sí ve el link y accede al formulario. (UI ya responsive; sin cambios de layout — ADR-025 no afectado.)

## Modelo de datos y migraciones
Sin tablas nuevas. Migración forward-only que hace `create or replace` de
`public.create_tenant_with_owner(p_name, p_nit)` añadiendo el check de owner previo al insert.

## Políticas RLS requeridas
Sin cambios.

## Funciones RPC e invariantes
`create_tenant_with_owner(p_name text, p_nit text default null) returns uuid` — invariantes:
- usuario autenticado; nombre no vacío (preexistentes);
- **nuevo**: `not exists (memberships where user_id = auth.uid() and role = 'owner')`, si no → `P0001`.

## Casos borde
- Usuario invitado (admin/member) sin empresa propia → puede crear la suya (pasa a tener 1 owner + N invitadas).
- Acceso directo a `/onboarding?crear` siendo owner → redirect servidor a `/inicio`; llamada directa a la RPC → P0001.
- Usuarios legados con 2+ owner: siguen operando; solo no pueden crear más.

## Consideraciones de seguridad (docs/arch/seguridad.md)
El enforcement vive en la RPC (BD), no en la UI — los checks de UI son UX. La Server Action
mantiene Zod y errores genéricos salvo el mensaje de negocio P0001 (sin datos internos).

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S11-01-limite-un-owner.sql | RPC crea tenant+owner para usuario sin membresías |
| 2 | pgTAP | supabase/tests/S11-01-limite-un-owner.sql | throws_ok P0001 + conteo de tenants sin cambio (atomicidad) |
| 3 | pgTAP | supabase/tests/S11-01-limite-un-owner.sql | member invitado puede crear su empresa |
| 4 | Manual | — | link condicional en sidebar y redirect de `?crear` (verificación manual; sin lógica nueva testeable unitariamente) |

## Historial
- 2026-07-24 · creada (draft) y aprobada por el humano vía plan de sesión (plan mode, opción "Restringir creación").
- 2026-07-24 · implementada (TDD: rojo confirmado en tests 3-4 antes de la migración; luego
  341/341 pgTAP en verde con `supabase db reset` + `supabase test db`). C6 del test histórico
  `S1-03-onboarding.sql` actualizado a la regla nueva. `npm run lint`, `npx tsc --noEmit` y
  Vitest 138/138 en verde. Sin cambios de esquema → `database.types.ts` sin regenerar.
