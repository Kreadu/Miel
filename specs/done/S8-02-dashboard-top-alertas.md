---
id: S8-02
titulo: Top de productos vendidos y rentables, y alertas de stock
estado: implemented
depende_de: [S8-01, S7-02, S2-05]
---

# S8-02 — Top de productos vendidos y rentables, y alertas de stock

## Contexto y valor
El gerente necesita conocer de un vistazo el rendimiento comercial de su catálogo y actuar rápidamente ante quiebres de inventario. Incluir los tops de productos y las alertas de stock directamente en el dashboard centraliza la toma de decisiones.

## Alcance
- Integración en la página del Dashboard (`src/app/(app)/inicio/page.tsx`) de componentes UI para mostrar:
  - **Top 10 productos más vendidos** (mayor `sold_qty`).
  - **Top 10 productos menos vendidos** (menor `sold_qty`).
  - **Top 10 productos más rentables** (mayor `margin_percent`).
  - **Alertas de bajo stock** (lista breve de los productos en estado crítico).
- Consultas directas (Server Components) a las vistas ya existentes `product_profitability` y `low_stock_alerts`.
- Reutilización de los permisos actuales (solo `owner` y `admin` ven el dashboard completo).

## NO-alcance (explícito)
- Modificaciones a nivel de base de datos, migraciones o alteraciones de vistas (todo lo necesario de BD ya existe desde S2-05 y S7-02 y tiene tests pgTAP pasando).
- Tops filtrados por un rango de fechas interactivo (Fase 2, actualmente es top histórico o según defina la vista).

## Criterios de aceptación
1. **Dado** un `owner` o `admin`, **cuando** visita el dashboard (`/inicio`), **entonces** ve una tabla/lista con los 10 productos más vendidos (ordenados por cantidad vendida descendente).
2. **Dado** un `owner` o `admin`, **cuando** visita el dashboard, **entonces** ve una tabla/lista con los 10 productos más rentables (ordenados por margen porcentual descendente).
3. **Dado** un `owner` o `admin`, **cuando** visita el dashboard, **entonces** ve la lista de productos bajo su stock mínimo (alertas), con acceso directo a sus detalles o al módulo de inventario/compras.
4. **Dado** un `member`, **cuando** intenta visitar la página `/inicio`, **entonces** es redirigido o se le bloquea el acceso (comportamiento ya garantizado por S8-01).
5. **Dado** un `owner` o `admin`, **cuando** visita el dashboard, **entonces** ve una tabla/lista con los 10 productos menos vendidos (ordenados por cantidad vendida ascendente).

## Modelo de datos y migraciones
**N/A**. Se utilizan las vistas preexistentes:
- `public.product_profitability` (creada en S7-02)
- `public.low_stock_alerts` (creada en S2-05)

## Políticas RLS requeridas
**N/A**. Las vistas ya incluyen el filtrado explícito por `tenant_id` y restricción de rol (`user_is_tenant_admin` para rentabilidad).

## Funciones RPC e invariantes
**N/A**. Es solo visualización de lectura.

## Casos borde
- **Cero productos vendidos o sin rentabilidad**: Los componentes de tops deben mostrar un estado vacío (empty state) amigable indicando que no hay datos aún.
- **Cero alertas de stock**: Mostrar un estado verde/amigable (ej. "Todo en orden") para confirmar que no hay quiebres de inventario.

## Consideraciones de seguridad (docs/arch/seguridad.md)
Al usar vistas preexistentes, la seguridad a nivel de datos (RLS/Aislamiento) ya está cubierta. La validación en el servidor para el acceso a la ruta `/inicio` también está cubierta desde S8-01. Los nuevos componentes servidor que consulten estas vistas heredarán la seguridad del contexto de Supabase.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2, 3, 5 | TSC / Lint | `npm run lint` & `tsc` | Verificación de tipos y reglas de renderizado React/Next en los nuevos componentes. No hay lógica compleja de negocio que amerite pruebas unitarias adicionales en Zod, ya que las consultas son directas de BD. |
| 1, 2, 3, 5 | pgTAP | (Existentes) | Las aserciones sobre cálculos precisos y aislamiento ya están en `S7-02-finanzas.sql` y `S2-05-alertas-stock.sql`. |

## Historial
- 2026-07-21 · creada (draft)
- 2026-07-21 · corrección: el BACKLOG original (`docs/BACKLOG.md:84`) incluía "menos vendidos" como criterio, omitido en el draft inicial sin registro. Se reincorpora como CA5 y se añade el panel "Top 10 menos vendidos" (misma vista `product_profitability`, orden `sold_qty` ascendente).
