---
id: S1-04
titulo: Layout de app, navegación y tenant activo
estado: implemented
depende_de: [S1-03]
---

# S1-04 — Layout de app y tenant activo

## Contexto y valor
Los módulos del ERP necesitan un marco común: rutas protegidas, navegación lateral y —
crítico para la seguridad — un "tenant activo" resuelto en servidor que el cliente no pueda
falsificar. Toda historia posterior cuelga de este layout.

## Alcance
- Grupo de rutas `(app)` protegido: sin sesión → `/login`; con sesión sin tenant → `/onboarding`.
- Sidebar con los módulos del MVP (enlaces; los módulos aún vacíos muestran placeholder
  "próximamente") + menú de usuario (email, logout).
- Tenant activo: cookie httpOnly con el tenant elegido, **siempre validada en servidor
  contra `memberships`** (cookie inválida o ajena → se ignora y se toma el primer tenant
  del usuario). Helper de servidor `getActiveTenant()` único punto de lectura.
- Selector de empresa (si el usuario tiene >1 tenant) que fija la cookie vía Server Action.
- La UI del sidebar respeta la matriz de permisos: módulos de Finanzas/Dashboard ocultos
  para `member` (la frontera real sigue siendo RLS).
- Estados según `miel-design`: loading (skeleton), vacío, error.

## NO-alcance (explícito)
- Contenido real de ningún módulo (E2+). Invitaciones y gestión de roles (S1-05).
- Persistencia de preferencias de UI (tema, colapso de sidebar) más allá de lo ya existente.
- Breadcrumbs y búsqueda global (Fase 2).

## Criterios de aceptación
1. **Dado** un anónimo **cuando** visita cualquier ruta `(app)` **entonces** es redirigido a
   `/login` con `next=` de retorno.
2. **Dado** un autenticado sin membership **cuando** visita `(app)` **entonces** es
   redirigido a `/onboarding`.
3. **Dado** un usuario con 2 empresas **cuando** cambia de empresa en el selector
   **entonces** la cookie se actualiza en servidor y el layout muestra la empresa elegida
   tras recargar datos.
4. **Dado** una cookie de tenant manipulada (tenant ajeno o inexistente) **cuando** el
   servidor la valida **entonces** la descarta y usa el primer tenant legítimo del usuario
   (nunca datos de otro tenant — RLS además lo garantiza).
5. **Dado** un `member` **cuando** ve el sidebar **entonces** no aparecen Finanzas ni
   Dashboard gerencial; para owner/admin sí (matriz `arch/permisos-roles.md`).

## Modelo de datos y migraciones
N/A — sin tablas nuevas. Lee `tenants` y `memberships` (RLS de S1-01 aplica).

## Políticas RLS requeridas
Sin políticas nuevas. El helper `getActiveTenant()` implementa la regla 3 de
`multitenancy-rls.md`: el cliente jamás decide el tenant; el servidor valida contra
`memberships`.

## Funciones RPC e invariantes
N/A — lecturas simples con el cliente server de Supabase (RLS filtra).

## Casos borde
- Usuario pierde su única membership con la sesión abierta → siguiente request lo manda a
  `/onboarding`.
- Cookie de un tenant del que fue removido → caso del criterio 4 (descartar y sanear cookie).
- Usuario con 1 sola empresa → el selector no se muestra (o aparece deshabilitado).
- Rol cambia (member→admin) en caliente → el sidebar refleja el rol en el siguiente render
  de servidor (sin invalidación en tiempo real; aceptado en MVP).

## Consideraciones de seguridad (docs/arch/seguridad.md)
- **La cookie de tenant es dato no confiable**: httpOnly y SIEMPRE validada en servidor
  contra `memberships` (criterio 4) — es el corazón de la historia; `getActiveTenant()` es
  el único punto de lectura.
- **La UI oculta, RLS protege**: el sidebar por rol (criterio 5) es UX, no seguridad; la
  frontera real sigue siendo RLS + matriz `arch/permisos-roles.md`.
- **Redirecciones**: siempre a rutas internas fijas (`/login`, `/onboarding`); el `next=`
  que genera esta historia lo consume el validador anti open redirect de S1-02.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 3, 4 | Vitest | src/lib/tenant/active-tenant.test.ts | lógica pura de resolución/validación del tenant activo (memberships simuladas) |
| 5 | Vitest | src/lib/tenant/nav-visibility.test.ts | visibilidad de módulos por rol según la matriz |
| 1, 2 | Manual guiado | — | redirecciones en local (checklist en PR); e2e formal en S9-01 |

## Historial
- 2026-07-19 · creada (draft) en la auditoría integral pre-desarrollo — pendiente de aprobación humana.
- 2026-07-19 · ADR-020: sección "Consideraciones de seguridad" agregada (retrofit del
  estándar de seguridad).
- 2026-07-19 · aprobada (draft → approved) por el humano. Decisión: la ruta hogar del grupo
  `(app)` (destino de `DEFAULT_AUTHENTICATED_PATH` y de `/onboarding` con tenant ya creado)
  es `/inicio` — página neutral por rol, no un módulo específico.
- 2026-07-19 · implementada con TDD (`estado: implemented`). Ver detalle en SESSION_LOG.
- 2026-08-15 · **superseded parcial (S11-05)**: el criterio 5 mencionaba "Dashboard gerencial"
  como módulo oculto para `member`. La ruta `/dashboard` se elimina (ADR-027): el resumen
  gerencial de la épica E8 vive en `/inicio`, no en un módulo aparte. El criterio 5 queda
  vigente solo para Finanzas y Gastos. Ver `specs/done/S11-05-orden-menu-lateral.md`.
- 2026-07-20 · **retrofit (bug encontrado en S1-05)**: `getActiveTenant()` leía
  `memberships` sin filtrar `user_id`, asumiendo una fila por tenant. La política RLS de
  `memberships` es visible a todo el equipo del tenant, no solo a la fila propia — invisible
  mientras cada tenant tuvo un solo miembro (todo Sprint 1 hasta S1-05). Con ≥2 miembros la
  query devolvía una fila por compañero y `resolveActiveTenant` tomaba la primera por
  `tenant_id` (casi siempre la del owner), haciendo que un `member` viera el rol de otro
  usuario. Corregido en S1-05 con `.eq('user_id', user.id)` explícito en
  `src/lib/tenant/server.ts`. Detalle completo en el historial de
  `specs/done/S1-05-invitaciones-roles.md`.
