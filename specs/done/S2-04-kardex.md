---
id: S2-04
titulo: Vistas de Stock Actual y Kardex
estado: approved
depende_de: [S2-03]
---

# S2-04 — Vistas de Stock Actual y Kardex

## Contexto y valor
Para operar y tomar decisiones, el equipo necesita conocer el estado del inventario. Esta historia provee el "Stock Actual" agregado por producto y bodega, y el "Kardex" histórico inmutable que reconstruye los movimientos y valoriza el inventario en tiempo real. Se diseña garantizando una baja carga cognitiva (UI limpia e intuitiva) y estricto aislamiento multitenant.

## Alcance
- Creación de la vista `current_stock` (agregación del stock y valorización total por producto y bodega).
- Creación de la vista `kardex` (historial cronológico de movimientos con saldos acumulados de cantidad y valor, y recálculo del costo promedio).
- Protección explícita de RLS en ambas vistas (`WHERE tenant_id IN (SELECT public.user_tenant_ids())`).
- Enmascaramiento de costos: el rol `member` verá las columnas `total_value`, `unit_cost`, `accumulated_value` y `average_cost` como `null` en estas vistas.
- Interfaz (UI): Página principal de "Inventario" con el listado de Stock Actual (búsqueda y filtro por bodega) y la posibilidad de navegar al detalle del Kardex de un producto.

## NO-alcance (explícito)
- Modificación de registros (eso lo hace S2-03).
- Alertas de stock mínimo (eso es S2-05).

## Criterios de aceptación
1. **Dado** un conjunto de movimientos de stock **cuando** consulto `current_stock` **entonces** veo la cantidad neta y el valor total de cada producto por bodega.
2. **Dado** un historial de movimientos **cuando** consulto el `kardex` **entonces** las window functions calculan correctamente el saldo acumulado (qty) y valor acumulado en cada paso cronológico.
3. **Dado** un usuario con rol `member` **cuando** consulta las vistas de stock/kardex **entonces** puede ver las cantidades (`qty`) pero los campos de costo/valor le retornan `null`.
4. **Dado** un escenario multitenant **cuando** un usuario consulta las vistas **entonces** es matemáticamente imposible que reciba filas de otro tenant (vistas aisladas explícitamente).

## Modelo de datos y migraciones
```sql
CREATE OR REPLACE VIEW public.current_stock AS
SELECT
  product_id,
  warehouse_id,
  tenant_id,
  SUM(qty) AS total_qty,
  CASE 
    WHEN public.user_is_tenant_admin(tenant_id) THEN SUM(qty * unit_cost) 
    ELSE NULL 
  END AS total_value
FROM public.stock_movements
WHERE tenant_id IN (SELECT public.user_tenant_ids())
GROUP BY product_id, warehouse_id, tenant_id;

CREATE OR REPLACE VIEW public.kardex AS
SELECT
  id AS movement_id,
  tenant_id,
  product_id,
  warehouse_id,
  created_at AS date,
  ref_type,
  ref_id,
  kind,
  qty,
  CASE WHEN public.user_is_tenant_admin(tenant_id) THEN unit_cost ELSE NULL END AS unit_cost,
  SUM(qty) OVER w AS accumulated_qty,
  CASE WHEN public.user_is_tenant_admin(tenant_id) THEN 
    SUM(qty * unit_cost) OVER w
  ELSE NULL END AS accumulated_value
FROM public.stock_movements
WHERE tenant_id IN (SELECT public.user_tenant_ids())
WINDOW w AS (PARTITION BY tenant_id, product_id, warehouse_id ORDER BY created_at, id);
```
*(Nota: la UI debe poder cruzar/embeber los datos de `products` para mostrar nombres, SKU y el precio de venta público).*

## Políticas RLS requeridas
Las vistas por defecto en Postgres ejecutan con privilegios del owner (Postgres tiene bypass RLS en Supabase), por lo que el `WHERE tenant_id IN (SELECT public.user_tenant_ids())` cumple la función de la política RLS directamente dentro de la consulta.

## Funciones RPC e invariantes
No aplica funciones transaccionales. La seguridad reside en la definición inmutable de las vistas.

## Casos borde
- `member` viendo el listado: la UI mostrará "—" en las columnas financieras.
- Costo promedio matemático en el Kardex: si `accumulated_qty > 0`, se calcula en la UI como `accumulated_value / accumulated_qty`, o puede retornar de la vista.

## Consideraciones de seguridad
Se restringe el acceso columnar devolviendo `NULL` a nivel SQL a roles no autorizados, evitando depender de que el front-end los oculte. Aislamiento estricto de multitenancy repetido dentro de cada vista.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2 | pgTAP | `supabase/tests/S2-04-kardex.sql` | Cálculos exactos de sumas y acumulados con un fixture conocido. |
| 3 | pgTAP | `supabase/tests/S2-04-kardex.sql` | El rol `member` recibe null en campos financieros. |
| 4 | pgTAP | `supabase/tests/S2-04-kardex.sql` | El usuario A no ve movimientos del tenant B en las vistas. |

## Historial
- 2026-07-20 · creada (approved)
