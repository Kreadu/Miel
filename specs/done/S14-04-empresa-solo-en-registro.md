---
id: S14-04
titulo: La empresa se funda solo en el registro inicial
estado: implemented      # draft → approved → implemented
depende_de: [ADR-026]
---

# S14-04 — La empresa se funda solo en el registro inicial

## Contexto y valor
El BACKLOG pedía "ocultar el selector de empresas con una sola membership", pero
`tenant-switcher.tsx:13` ya lo oculta (`memberships.length <= 1`). Lo único que un usuario con
1 sola empresa sigue viendo es el link "+ Crear mi empresa", visible para el invitado sin
empresa propia. Decisión del humano: la creación de empresa debe ocurrir solo en el registro
inicial, nunca desde un usuario ya invitado a otra — supersede el punto de ADR-026 que lo
permitía, así que la regla se mueve a la BD (frontera real) y se documenta en ADR-031.

## Alcance
- ADR-031 en `docs/DECISIONS.md`.
- Migración: `create_tenant_with_owner` rechaza (P0001) si el usuario tiene *cualquier*
  membership, no solo si ya es `owner`.
- `(app)/layout.tsx`: se retira el bloque "+ Crear mi empresa" (y el import `Link` huérfano).
- `onboarding/page.tsx`: se retira el soporte de `?crear`; con cualquier membership redirige a
  `/inicio`.
- Test nuevo para `TenantSwitcher` (hoy sin cobertura propia).

## NO-alcance (explícito)
- `tenant-switcher.tsx`: sin cambios de comportamiento, ya oculta con 1 membership.
- `src/actions/onboarding.ts`: sin cambios, ya propaga el mensaje P0001.
- Flujo de invitaciones (`accept_invitation`): intacto.
- Migración de datos de usuarios que ya fundaron empresa siendo invitados: ninguna (regla hacia
  adelante).

## Criterios de aceptación
1. **Dado** un usuario sin ninguna membership **cuando** llama `create_tenant_with_owner`
   **entonces** crea su empresa y queda `owner` (caso feliz intacto).
2. **Dado** un usuario con cualquier membership (`owner`, `admin` o `member`) **cuando** llama
   `create_tenant_with_owner` **entonces** la RPC rechaza con P0001 y mensaje de negocio, sin
   dejar tenant huérfano.
3. **Dado** el sidebar de un usuario con 1 sola empresa **cuando** se renderiza en desktop o en
   el drawer móvil (375px) **entonces** no hay selector de empresas ni link "+ Crear mi empresa".
4. **Dado** un usuario autenticado con membership **cuando** visita `/onboarding` o
   `/onboarding?crear` **entonces** redirige a `/inicio`.
5. **Dado** viewport 375px con el sidebar sin el link retirado **entonces** no hay scroll
   horizontal del body.

## Modelo de datos y migraciones
`create_tenant_with_owner` (`create or replace`, forward-only): la condición de rechazo pasa de
`role = 'owner'` a cualquier fila en `memberships` para `auth.uid()`. Mensaje P0001 nuevo: "Ya
perteneces a una empresa en Miel. Las empresas se crean solo al registrarte." Resto de la
función (validación de sesión, nombre vacío, insert atómico tenant+membership) intacto.

## Políticas RLS requeridas
N/A — sin tablas nuevas. La RPC sigue `security definer` como hasta ahora (S1-03/S11-01); no
cambia su modelo de seguridad, solo la condición de negocio.

## Funciones RPC e invariantes
- `create_tenant_with_owner(p_name, p_nit)`: invariante nueva — "un usuario con cualquier
  membership no puede crear otra empresa" (antes: "un owner no puede crear una segunda").
  Atomicidad estructural (ya cubierta desde S1-03): ningún tenant sin su membership owner.

## Casos borde
- Usuario invitado como `member`/`admin` sin ser nunca owner: antes podía fundar su empresa,
  ahora no — debe registrarse con otro correo (documentado en el ADR).
- Intento repetido tras el rechazo: no dejó tenant parcial (mismo test de atomicidad de S11-01).

## Consideraciones de seguridad (docs/arch/seguridad.md)
La regla de negocio vive en la RPC (`security definer`), no solo en la UI — un cliente que
llame la RPC directo también queda sujeto. Mensaje de error de negocio, sin detalles internos
(mismo patrón ya usado en `onboarding.ts`). Sin boundary de servidor nuevo.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2 | pgTAP | supabase/tests/S14-04-empresa-solo-en-registro.sql | Caso feliz sin membership; rechazo P0001 con cualquier rol previo; atomicidad |
| 1, 2 | pgTAP | supabase/tests/S11-01-limite-un-owner.sql (editado) | Invierte "member invitado sí crea" a `throws_ok` (regla más amplia) |
| 3 | Vitest | src/app/(app)/tenant-switcher.test.tsx | 1 membership → null; 2+ → renderiza selector |
| 4 | E2E | e2e/core-flow.spec.ts | `/onboarding?crear` autenticado redirige a `/inicio` |
| 5 | Manual | — | 375px sin overflow tras retirar el link, claro/oscuro |

## Historial
- 2026-08-16 · creada y aprobada por el humano vía plan mode (approved)
- 2026-08-16 · implementada (migración + UI + ADR-031), verificada end-to-end (implemented)
