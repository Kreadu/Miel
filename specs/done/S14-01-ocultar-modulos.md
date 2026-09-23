---
id: S14-01
titulo: Ocultar Finanzas y Producción del menú
estado: implemented            # draft → approved → implemented
depende_de: [S11-05]
---

# S14-01 — Ocultar Finanzas y Producción del menú

## Contexto y valor

El dueño de PYME (perfil objetivo del ERP) no usa hoy los módulos Finanzas y Producción; verlos en
el menú y en Inicio distrae de las tareas diarias (Vender/Comprar/Inventario/Gastos). No es una
decisión de producto de eliminar los módulos — es ocultarlos hasta que el usuario los necesite,
de forma reversible.

## Alcance

- `src/lib/tenant/nav-visibility.ts`: `visibleNavItems()` deja de devolver los ítems de
  `/produccion` y `/finanzas`, para cualquier rol.
- `src/app/(app)/inicio/page.tsx` no se toca: sus tarjetas ya derivan de `visibleNavItems()`
  (`inicio/page.tsx:16`), así que quedan ocultas automáticamente.
- El divisor visual (`separatorBefore`, hoy en `/produccion`) deja de dibujarse al desaparecer su
  ítem — sin cambios en `sidebar-nav.tsx`.

## NO-alcance (explícito)

- No se borra código, rutas ni el ítem de `NAV_ITEMS` — reversible vaciando el filtro.
- No se agregan redirects en `/finanzas` ni `/produccion`: siguen respondiendo por URL directa.
- No se reordena Inicio (S14-02), no se enlaza el logo (S14-03), no se oculta el selector de
  empresas (S14-04), no se toca el header móvil (S11-02).

## Criterios de aceptación

1. **Dado** cualquier rol (`owner`, `admin`, `member`), **cuando** se pinta el sidebar,
   **entonces** no aparecen los ítems Finanzas ni Producción.
2. **Dado** cualquier rol, **cuando** se carga `/inicio`, **entonces** las tarjetas de módulos no
   incluyen Finanzas ni Producción (se derivan del mismo `visibleNavItems()`).
3. **Dado** el ítem Producción oculto, **cuando** se pinta el sidebar, **entonces** ningún ítem
   visible dibuja el divisor (`separatorBefore`) — el grupo de gestión (hoy solo Equipo) queda sin
   separador huérfano.
4. **Dado** un usuario autenticado, **cuando** navega directamente a `/finanzas` o `/produccion`
   por URL, **entonces** la página sigue cargando con normalidad (sin redirect, sin 404).
5. **Dado** el sidebar en viewport 375px (`Sheet` móvil), **cuando** se abre el drawer,
   **entonces** no hay scroll horizontal del body (`scrollWidth <= clientWidth + 1`) — sin
   regresión del gate existente (ADR-025).

## Modelo de datos y migraciones

N/A. Sin cambios de esquema.

## Políticas RLS requeridas

N/A. Ocultamiento de UI, no cambio de autorización — la frontera real (RLS) no se toca.

## Funciones RPC e invariantes

N/A.

## Casos borde

- Un usuario con rol `member` (que ya no veía Finanzas por `ownerAdminOnly`) tampoco debe verlo
  ahora por el nuevo filtro — sin duplicar lógica, el filtro nuevo corre antes que el de rol.
- `NAV_ITEMS` (el array crudo, sin filtrar) conserva Finanzas/Producción intactos para que
  revertir sea vaciar una constante, no reconstruir el array.

## Consideraciones de seguridad (docs/arch/seguridad.md)

N/A — cambio puramente de presentación (UX), no es frontera de seguridad; la ocultación de
`ownerAdminOnly` para `member` (control real es RLS) tampoco cambia.

## Plan de tests (qué test cubre qué criterio)

| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | Vitest | `src/lib/tenant/nav-visibility.test.ts` | `/produccion` y `/finanzas` ausentes en `visibleNavItems()` para owner/admin/member |
| 2 | — | — | Cubierto por el mismo test de (1): Inicio deriva del mismo `visibleNavItems()`, sin lógica propia que testear |
| 3 | Vitest | `src/lib/tenant/nav-visibility.test.ts` | Ningún ítem visible tiene `separatorBefore: true` |
| 4 | Manual (Playwright ad-hoc) | — | `/finanzas` y `/produccion` cargan por URL directa sin redirect |
| 5 | Playwright (gate existente) | `e2e/responsive.spec.ts` | Sin regresión de scroll horizontal a 375px |

pgTAP: N/A — sin cambios en `supabase/`.

## Historial
- 2026-08-15 · creada y aprobada por el humano vía plan mode (approved)
- 2026-08-15 · implementada, movida a specs/done/ (implemented)
