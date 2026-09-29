---
id: S14-06
titulo: Accesos directos de Inicio apuntan a la raíz del módulo
estado: implemented
depende_de: [S14-02]
---

# S14-06 — Accesos directos de Inicio apuntan a la raíz del módulo

## Contexto y valor

S14-02 creó los accesos directos "Vender" y "Agregar al inventario" en `/inicio`, apuntando
directo a la acción (`/ventas/pos`, `/inventario/productos`). El dueño ahora prefiere que ambos
lleven a la raíz de su módulo (`/ventas`, `/inventario`) en vez de saltar directo a una pantalla
de acción específica, para poder orientarse dentro del módulo antes de elegir qué hacer.

## Alcance

- `inicio/quick-actions.tsx`: "Vender" → `/ventas` (antes `/ventas/pos`), "Agregar al inventario"
  → `/inventario` (antes `/inventario/productos`).
- Labels de los botones sin cambios.

## NO-alcance (explícito)

- No se cambia la visibilidad por rol (member sigue sin ver "Agregar al inventario").
- No se cambia el orden de secciones de `/inicio` (saludo → accesos directos → Módulos →
  Resumen gerencial, de S14-02).
- No se tocan `/ventas/page.tsx` ni `/inventario/page.tsx`.

## Criterios de aceptación

1. **Dado** un usuario owner o admin en `/inicio` **cuando** ve el bloque de accesos directos
   **entonces** el link "Vender" tiene `href="/ventas"`.
2. **Dado** un usuario owner o admin en `/inicio` **cuando** ve el bloque de accesos directos
   **entonces** el link "Agregar al inventario" tiene `href="/inventario"`.
3. **Dado** un usuario member en `/inicio` **cuando** ve el bloque de accesos directos
   **entonces** ve "Vender" (con `href="/ventas"`) pero no "Agregar al inventario".

## Modelo de datos y migraciones

N/A.

## Políticas RLS requeridas

N/A.

## Funciones RPC e invariantes

N/A.

## Casos borde

- Ninguno adicional a los cubiertos por S14-02 (cambio de destino de link, no de estructura ni
  de gating por rol).

## Consideraciones de seguridad (docs/arch/seguridad.md)

N/A — ambas rutas destino ya están protegidas por el layout `(app)` existente (auth + tenant
activo), sin cambios en esa capa.

## Plan de tests (qué test cubre qué criterio)

| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | Vitest | src/app/(app)/inicio/quick-actions.test.tsx | owner ve "Vender" con href `/ventas` |
| 2 | Vitest | src/app/(app)/inicio/quick-actions.test.tsx | owner ve "Agregar al inventario" con href `/inventario` |
| 3 | Vitest | src/app/(app)/inicio/quick-actions.test.tsx | member ve "Vender" pero no "Agregar al inventario" |

## Historial

- 2026-09-28 · creada (draft) y aprobada por el humano en la misma sesión (alcance confirmado vía
  AskUserQuestion: "Raíz de cada módulo").
- 2026-09-28 · implementada (TDD: test rojo confirmado antes del cambio de `href`, verde después).
  `npm run lint` ✓, `npx tsc --noEmit` ✓, `npm test` 217/217 ✓, `npm run build` ✓. No se pudo
  correr `npx playwright test` ni `supabase test db` (sandbox sin Docker/Supabase local, ya
  documentado en sesiones previas) — selector de `e2e/core-flow.spec.ts` actualizado por
  inspección de código (colisión de `href="/ventas"` con sidebar y tarjeta de Módulos,
  desambiguado acotando a `main` + `.first()`), pero sin ejecución real. Queda pendiente que una
  sesión con Playwright disponible confirme ese test.
