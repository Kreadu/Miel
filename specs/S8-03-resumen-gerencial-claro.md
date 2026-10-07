---
id: S8-03
titulo: Resumen gerencial claro (período visible, mes anterior, rankings recientes)
estado: descartada
depende_de: [S8-01, S8-02]
---

# S8-03 — Resumen gerencial claro

## Contexto y valor
En Inicio, "Ventas del mes" y "Utilidad del mes" cuentan solo el mes calendario en curso. El
7 de octubre de 2026 marcaban $0 aunque en septiembre se vendieron $792.540, y el dueño creyó
que estaba roto. Además, los rankings (más y menos vendidos, más rentables) cuentan desde siempre
sin decirlo, y "menos vendidos" nunca muestra lo que no se vendió nunca.

## Supuestos (decididos por el agente, confirmar al aprobar)
- **D1 · Período de los rankings: últimos 30 días**, no el mes calendario. Si fueran del mes,
  también saldrían vacíos los primeros días, que es justo el problema que se quiere evitar.
  El título lo dice: "Más vendidos · últimos 30 días".
- **D2 · "Menos vendidos"** incluye los productos activos de tipo "productos" (los que se venden)
  que no se vendieron en esos 30 días, con 0 und. No incluye insumos, mobiliario ni otros
  inventarios.
- **D3 · La comparación con el mes anterior** se muestra solo en Ventas y Utilidad. Inventario,
  cuentas por cobrar y cuentas por pagar son saldos de hoy, así que dicen "Hoy".

## Alcance
- **Tarjetas:** el título muestra el período ("Ventas · octubre 2026"). Debajo, en texto
  pequeño: "Mes anterior: $792.540". Inventario, por cobrar y por pagar llevan "Hoy".
- **BD:** `dashboard_metrics` gana `prev_month_sales` y `prev_month_utility`, al final de la vista
  para que `create or replace` sea válido. Vista nueva `product_ranking_30d` (por producto
  vendible: unidades, ingreso neto y margen de los últimos 30 días; 0 si no se vendió), con el
  mismo filtro de empresa y admin que las demás vistas gerenciales.
- **Rankings** en Inicio leen `product_ranking_30d`. "Más rentables" solo considera productos con
  ventas en el período. `product_profitability` queda como está (la cubre el pgTAP de S8-02).
- Textos es/en/fr. El nombre del mes, en el idioma del usuario.

## NO-alcance (explícito)
- Selector de período o rango (para eso está Resultados), gráficos, cambios a Resultados o
  Finanzas.

## Criterios de aceptación
1. **Dado** ventas solo en septiembre **cuando** el dueño abre Inicio en octubre **entonces** ve
   "Ventas · octubre 2026 · $0" y debajo "Mes anterior: $792.540". Lo mismo para la utilidad.
2. **Dado** un producto vendible sin ventas en los últimos 30 días **entonces** aparece en
   "Menos vendidos · últimos 30 días" con 0 und. Un insumo nunca aparece ahí.
3. **Dado** ventas de hace 40 días y de hace 5 **entonces** los rankings solo cuentan las de hace
   5. Las ventas canceladas no cuentan.
4. **Dado** un operativo o una empresa ajena **entonces** `product_ranking_30d` no devuelve filas
   (mismo aislamiento que S8-01/02).
5. En 375px las tarjetas se apilan en una columna, el texto del mes anterior no desborda y no hay
   scroll horizontal.

## Modelo de datos y migraciones
Migración `…_resumen-gerencial-claro.sql`:
- `create or replace view dashboard_metrics`: lo mismo de antes más el CTE `pnl_prev` (mes anterior
  en hora de Bogotá) y dos columnas al final.
- `create view product_ranking_30d`: `products` (activos, `inventory = 'productos'`) con left join a
  `sale_items` y `sales` (`status in ('confirmed','shipped','delivered')` e
  `issued_at >= now() - interval '30 days'`). Columnas: `tenant_id, product_id, sku, name,
  sold_qty, net_income, margin_amount, margin_percent`.

## Políticas RLS requeridas
Vistas sin tablas nuevas. Patrón de `supabase-miel` para vistas que corren como su dueño: filtro
explícito `tenant_id in (select user_tenant_ids())` y `user_is_tenant_admin(tenant_id)` en el
`where` (los costos y márgenes son solo para dueño y admin). `grant select` a `authenticated`.

## Funciones RPC e invariantes
N/A (solo lectura).

## Casos borde
- Enero: el mes anterior es diciembre del año pasado (`date_trunc` en hora de Bogotá).
- Empresa nueva sin ventas: $0 en todo, "Mes anterior: $0", y "Menos vendidos" lista los
  productos con 0 und.
- Venta cancelada o devuelta (status `cancelled`): no cuenta.
- Producto archivado (`active = false`): no aparece en los rankings.

## Consideraciones de seguridad
Solo lectura. El aislamiento de la vista nueva lo cubre pgTAP (criterio 4). Sin boundaries nuevos.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S8-03-resumen-gerencial-claro.sql | prev_month_sales y prev_month_utility con ventas del mes anterior |
| 2,3,4 | pgTAP | (mismo) | ventana de 30 días, 0 para los no vendidos, sin insumos ni canceladas, aislamiento por empresa y rol |
| 1 | Vitest | src/lib/dashboard/period.test.ts | etiqueta del mes actual y del anterior (cambio de año, zona Bogotá) |

El humano corre el pgTAP y revisa Inicio a 375px (regla 9).

## Historial
- 2026-10-07 · creada (draft) con supuestos D1–D3 pendientes de confirmar.
- 2026-10-07 · descartada por el humano (se prioriza la tienda en línea, E27).
