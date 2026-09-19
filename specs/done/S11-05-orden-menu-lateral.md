---
id: S11-05
titulo: Reordenar el menú lateral por flujo de negocio
estado: implemented
depende_de: [S1-04]
supersede:
  - spec: S1-04-layout-tenant-activo
    criterio: 5
    motivo: >
      El criterio 5 nombra "Dashboard gerencial" como módulo oculto para member. Esta historia
      elimina la ruta /dashboard del producto (ADR-027): el dashboard gerencial vive en /inicio
      desde E8 (S8-01, S8-02). El criterio 5 queda vigente solo para Finanzas y Gastos.
---

# S11-05 — Reordenar el menú lateral por flujo de negocio

## Contexto y valor
El menú lateral (`src/lib/tenant/nav-visibility.ts`) está ordenado por cómo se construyó el
producto, no por cómo un dueño de PYME opera a diario: Ventas queda en 4ª posición pese a ser la
acción más frecuente, y Compras (costo de la oferta) no se distingue visualmente de Gastos (opex),
el error conceptual más común del usuario no contable. Además `/dashboard` es un placeholder vacío
que duplica `/inicio` (donde vive el resumen gerencial real desde E8) y ocupa un puesto del menú.

## Alcance
- Reordenar `NAV_ITEMS` en dos grupos separados por un divisor visual, sin encabezados de grupo:
  operación diaria (Inicio, Ventas, Compras, Inventario, Gastos) y gestión (Producción, Finanzas,
  Equipo).
- Renombrar labels: "Ventas" → "Vender", "Compras" → "Comprar". Los `href` (`/ventas`, `/compras`)
  no cambian.
- Eliminar la ruta `/dashboard` y su componente placeholder (`ModulePlaceholder`), que queda sin
  otro consumidor.
- Añadir a cada página índice afectada (Ventas, Compras, Inventario, Gastos) una descripción corta
  en el encabezado que explique qué se hace en esa sección.
- El comportamiento de `visibleNavItems(role)` (ocultar `ownerAdminOnly` a `member`) no cambia.

## NO-alcance (explícito)
- No se renombran rutas (`href`), solo labels.
- No se agregan tooltips ni iconos informativos en el sidebar (no existe primitiva Tooltip en el
  proyecto y no funcionaría por tap en el `Sheet` móvil); la explicación va en el encabezado de
  cada página.
- No se introduce un modelo de "grupos" con encabezado propio: solo un divisor visual antes de
  Producción.
- No se toca el comportamiento de colapso/drawer del sidebar (ya cubierto por S10-01).

## Criterios de aceptación
1. **Dado** un `owner` o `admin` **cuando** ve el sidebar **entonces** los items aparecen en este
   orden exacto: Inicio, Vender, Comprar, Inventario, Gastos, [divisor], Producción, Finanzas,
   Equipo.
2. **Dado** un `member` **cuando** ve el sidebar **entonces** ve Inicio, Vender, Comprar,
   Inventario, [divisor], Producción (Gastos, Finanzas y Equipo ocultos); el divisor precede
   siempre a Producción, sin quedar duplicado ni al inicio de la lista.
3. **Dado** cualquier rol **cuando** ve el sidebar **entonces** no existe ningún item "Dashboard" y
   la ruta `/dashboard` ya no responde (404).
4. **Dado** un usuario **cuando** visita `/ventas`, `/compras`, `/inventario` o `/gastos`
   **entonces** el encabezado de la página incluye una frase que explica el propósito de esa
   sección (ver tabla de copys en el plan de implementación).
5. **Dado** el sidebar en `/inicio` **cuando** se renderiza la grilla de "Módulos" **entonces**
   refleja el mismo orden y labels nuevos ("Vender", "Comprar") y no dibuja el divisor dentro de la
   grilla.
6. **Dado** el `Sheet` de navegación móvil (`<md`) **cuando** se abre a 375px **entonces** el orden,
   el divisor y los labels son idénticos al desktop, sin scroll horizontal (ADR-025).

## Modelo de datos y migraciones
N/A — sin cambios en Supabase.

## Políticas RLS requeridas
N/A — `visibleNavItems` sigue siendo UX; la frontera de seguridad sigue siendo RLS
(`docs/arch/permisos-roles.md`), sin cambios en esta historia.

## Funciones RPC e invariantes
N/A.

## Casos borde
- `member` sin acceso a Gastos: el divisor debe seguir apareciendo antes de Producción, no antes de
  Inventario ni desaparecer.
- Cualquier enlace o bookmark externo a `/dashboard` recibe 404 tras el cambio (ruta eliminada,
  documentado en ADR-027).

## Historial
- 2026-08-15 · creada, aprobada e implementada con TDD en la misma sesión. `nav-visibility.ts`
  reordenado + `separatorBefore`; `sidebar-nav.tsx` dibuja el divisor; encabezados de
  Ventas/Compras/Inventario/Gastos actualizados; `/dashboard` y `ModulePlaceholder` eliminados
  (ADR-027); nota de superseder agregada a `specs/done/S1-04-layout-tenant-activo.md`.
  `npx vitest run src/lib/tenant/nav-visibility.test.ts` 8/8 ✓, `npm test` 152/152 ✓, lint ✓,
  `tsc --noEmit` ✓, `npm run build` ✓ (rutas confirmadas sin `/dashboard`).
