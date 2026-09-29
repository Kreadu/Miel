---
id: S14-07
titulo: Inicio queda solo con Módulos y Resumen gerencial (se quitan los accesos directos)
estado: implemented
depende_de: [S14-02, S14-06]
---

# S14-07 — Inicio queda solo con Módulos y Resumen gerencial

## Contexto y valor

El dueño pidió (instrucción explícita en sesión, retomada de una sesión anterior que se cortó)
que `/inicio` muestre solo "Módulos" y "Resumen gerencial" — sin el bloque de "Accesos directos"
("Vender", "Agregar al inventario") que agregó S14-02 y que S14-06 acababa de reapuntar. La
acción de vender/agregar inventario ya vive dentro de cada módulo: `/ventas` tiene un botón
primario "Punto de Venta" → `/ventas/pos`, e `/inventario` tiene "+ Nuevo producto" →
`/inventario/productos` (ambos preexistentes, no se tocan). Esto vuelve innecesario el atajo
duplicado en Inicio.

## Alcance

- `inicio/page.tsx`: se quita el render de `<QuickActions />` y su import. Queda: saludo →
  Módulos → Resumen gerencial.
- Se elimina `inicio/quick-actions.tsx` y `inicio/quick-actions.test.tsx` (código muerto tras
  el punto anterior — nada más los importa).
- `e2e/core-flow.spec.ts`: se quita la verificación de "Vender" como accesos directos / orden
  vertical de 3 secciones; queda una verificación de que "Módulos" aparece antes que "Resumen
  gerencial", y se mantiene la comprobación de 0 anchors a `/finanzas` (S14-01).

## NO-alcance (explícito)

- No se toca `/ventas/page.tsx` ni `/inventario/page.tsx` — sus botones primarios ya cubren el
  caso de uso.
- No se cambia `dashboard-metrics-cards.tsx` ni `dashboard-insights.tsx`.
- No se revierte S14-01 (Finanzas/Producción siguen ocultos).

## Criterios de aceptación

1. **Dado** cualquier rol en `/inicio` **cuando** carga la página **entonces** no hay ningún
   texto/link "Vender" ni "Agregar al inventario" fuera de la sección Módulos (donde "Vender" sí
   sigue existiendo como nombre del módulo de ventas, vía `NAV_ITEMS`).
2. **Dado** un owner/admin en `/inicio` **cuando** carga la página **entonces** el orden vertical
   es Módulos arriba de Resumen gerencial.
3. **Dado** un member en `/inicio` **cuando** carga la página **entonces** solo ve Módulos (sin
   Resumen gerencial, comportamiento preexistente sin cambios).

## Modelo de datos y migraciones

N/A.

## Políticas RLS requeridas

N/A.

## Funciones RPC e invariantes

N/A.

## Casos borde

- Ninguno adicional — es una eliminación de UI, no de datos ni de permisos.

## Consideraciones de seguridad (docs/arch/seguridad.md)

N/A.

## Plan de tests (qué test cubre qué criterio)

| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2 | Vitest/manual | — | cubierto por inspección + build (no hay componente que testear, se elimina) |
| 2 | Playwright | e2e/core-flow.spec.ts | orden Módulos antes de Resumen gerencial |

## Historial

- 2026-09-28 · creada y aprobada por el humano en la misma sesión (instrucción explícita:
  "solo debían quedar los módulos y el resumen gerencial... los botones que eliminaras deben ir
  dentro de los módulos respectivos" — ya cumplido, son preexistentes).
- 2026-09-28 · implementada. `npm run lint` ✓, `npx tsc --noEmit` ✓, `npm test` 214/214 ✓
  (baja de 217: se eliminaron los 3 tests de `quick-actions.test.tsx`, componente ahora
  inexistente), `npm run build` ✓. `e2e/core-flow.spec.ts` actualizado por inspección, no
  ejecutado (sin Playwright disponible en este sandbox, mismo motivo que S14-06).
