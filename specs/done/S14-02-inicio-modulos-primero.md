---
id: S14-02
titulo: Inicio muestra primero módulos y accesos directos, resumen gerencial abajo
estado: implemented
depende_de: [S8-01, S8-02, S14-01]
---

# S14-02 — Inicio muestra primero módulos y accesos directos, resumen gerencial abajo

## Contexto y valor

`/inicio` abre hoy con el "Resumen gerencial" (5 tarjetas de métricas + 4 paneles de listas) y
deja las tarjetas de "Módulos" al final de la página. El dueño de PYME entra a Inicio para hacer
algo (vender, cargar inventario), no para leer indicadores primero — la acción queda bajo el
pliegue, especialmente a 375px. Además, S14-01 ocultó el módulo Finanzas del menú, pero
`dashboard-metrics-cards.tsx` sigue enlazando 2 de sus tarjetas a `/finanzas` (hallazgo colateral
anotado en BACKLOG, resuelto en esta historia).

## Alcance

- Nuevo bloque "Accesos directos" (componente `quick-actions.tsx`) entre el saludo y "Módulos":
  "Vender" → `/ventas/pos` (todos los roles), "Agregar al inventario" → `/inventario/productos`
  (oculto a `member`).
- Reordenar `inicio/page.tsx`: saludo → accesos directos → Módulos → Resumen gerencial.
- Las tarjetas "Ventas del mes" y "Utilidad del mes" de `dashboard-metrics-cards.tsx` dejan de ser
  `<Link>` (pasan a `<div>` informativo); las otras 3 (inventario, por cobrar, por pagar)
  conservan su enlace.

## NO-alcance (explícito)

- No se toca `dashboard-insights.tsx` ni las vistas SQL (`product_profitability`,
  `low_stock_alerts`) que consume.
- No se colapsa, oculta ni lazy-loadea el resumen gerencial más allá de bajar de posición.
- No se cambia `NAV_ITEMS` ni `HIDDEN_HREFS` de `nav-visibility.ts` (S14-01 queda intacto).
- No se agrega un tercer acceso directo ("Registrar gasto" u otro).
- No se migra el `Intl.NumberFormat`/`formatCurrency` local de `dashboard-metrics-cards.tsx` a
  `src/lib/format.ts` (deuda preexistente desde antes de S12-02, se anota en BACKLOG, no se
  resuelve aquí).

## Criterios de aceptación

1. **Dado** un `owner` en `/inicio` **cuando** carga la página **entonces** el DOM presenta, en
   orden: saludo, accesos directos, "Módulos", "Resumen gerencial".
2. **Dado** un `member` **cuando** carga `/inicio` **entonces** ve el acceso "Vender" pero no
   "Agregar al inventario", y sigue sin ver la sección "Resumen gerencial" (regla previa a esta
   historia, sin cambios).
3. **Dado** cualquier rol **cuando** hace clic en "Vender" **entonces** navega a `/ventas/pos`; en
   "Agregar al inventario" navega a `/inventario/productos`.
4. **Dado** un `owner` con métricas cargadas **cuando** mira las tarjetas "Ventas del mes" y
   "Utilidad del mes" **entonces** no son enlaces (no hay ningún `<a href="/finanzas">` en toda la
   página de Inicio).
5. **Dado** viewport 375px **cuando** carga `/inicio` **entonces** los accesos directos apilan en
   1 columna y no hay scroll horizontal (`document.documentElement.scrollWidth <=
   document.documentElement.clientWidth + 1`).

## Modelo de datos y migraciones

N/A. Sin tablas, columnas ni vistas nuevas o alteradas; la historia es capa de presentación pura
sobre datos ya expuestos por `dashboard_metrics`, `product_profitability`, `low_stock_alerts`
(sin cambios).

## Políticas RLS requeridas

N/A. No se toca `supabase/`; las consultas existentes (`dashboard_metrics`, etc.) ya están
protegidas por las políticas vigentes, sin cambio de superficie de acceso.

## Funciones RPC e invariantes

N/A. Ningún boundary de servidor nuevo — `quick-actions.tsx` es presentacional puro (recibe
`role`, no hace fetch); no hay Server Action ni route handler nuevos.

## Casos borde

- Tenant nuevo sin filas en `dashboard_metrics`: `DashboardMetricsCards` ya cae a ceros (`data ||
  {...}`, sin cambios); las 2 tarjetas sin link muestran `$0` sin romper.
- `member`: `QuickActions` renderiza solo 1 tarjeta ("Vender") — el grid dedica 1 columna en móvil
  y no fuerza una segunda columna vacía en desktop.
- Sin tenant activo: `page.tsx:14` ya hace `redirect("/onboarding")` antes de renderizar cualquier
  sección — sin cambios.
- POS con caja cerrada: `ventas/pos/page.tsx` ya maneja `hasOpenSession` con su propio aviso; el
  acceso directo no necesita guardia adicional en Inicio.

## Consideraciones de seguridad (docs/arch/seguridad.md)

- Sin boundary de servidor nuevo → no aplica validación Zod de entrada.
- La UI sigue mostrando únicamente datos del tenant activo (`getActiveTenant()`, sin cambios en
  cómo se resuelve); no se introduce lectura cruzada de tenant.
- `quick-actions.tsx` no expone ningún dato sensible nuevo: son enlaces estáticos condicionados
  por `role`, que ya es la fuente de verdad de UX (la frontera real sigue siendo RLS, sin cambios
  aquí — mismo criterio documentado en `nav-visibility.ts:42`).

## Plan de tests (qué test cubre qué criterio)

| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 2, 3 | Vitest + RTL | `src/app/(app)/inicio/quick-actions.test.tsx` (nuevo) | owner/admin: 2 accesos con `href` correctos; `member`: solo "Vender", sin "Agregar al inventario" |
| 1, 4 | Playwright | `e2e/core-flow.spec.ts` (ampliado) | orden relativo de las 3 secciones en `/inicio`; 0 anchors a `/finanzas` en la página |
| 5 | Manual + Playwright ad-hoc (temporal) | — | 375px sin overflow horizontal, claro y oscuro |

Criterio 4 no es testeable en Vitest de forma aislada (el componente que lo determina,
`DashboardMetricsCards`, es async y consulta Supabase); se cubre en E2E/manual, sin fabricar
cobertura unitaria artificial.

## Historial

- 2026-08-15 · creada (draft) → aprobada vía plan mode (approved) → implementada con TDD en la
  misma sesión (implemented).
