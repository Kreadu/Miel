---
id: S2-05
titulo: Alertas de bajo stock
estado: implemented
depende_de: [S2-04]
---

# S2-05 — Alertas de bajo stock

## Contexto y valor
Para evitar quiebres de inventario, el gerente necesita saber oportunamente qué productos han caído por debajo de su nivel mínimo de stock definido. Esta historia provee visibilidad inmediata mediante indicadores visuales en el listado de inventario y una sección dedicada de alertas, permitiendo reponer a tiempo.

## Alcance
- Indicador visual (UI) en la página principal de "Inventario" (que usa `current_stock`) para resaltar los productos cuyo stock total es menor o igual a su `min_stock`.
- Nueva vista SQL `low_stock_alerts` que cruza el stock actual con el catálogo de productos para identificar aquellos bajo el mínimo.
- Sección/Pestaña dedicada "Alertas" dentro del módulo de Inventario que lista exclusivamente los productos en estado crítico, alimentada por la nueva vista.
- Protección explícita de RLS en la vista (aislamiento multitenant).

## NO-alcance (explícito)
- Envío de correos electrónicos o notificaciones push (Fase 2).
- Pedidos de compra automáticos (Fase 2).

## Criterios de aceptación
1. **Dado** un producto cuyo stock actual total (sumando todas las bodegas) es menor o igual a su `min_stock` (y `min_stock > 0`) **cuando** visito el listado de inventario **entonces** veo un indicador visual de alerta (ej. badge o color distintivo).
2. **Dado** uno o más productos con stock bajo el mínimo **cuando** consulto la sección "Alertas" **entonces** veo solo los productos afectados con su stock actual y el nivel mínimo requerido.
3. **Dado** un producto cuyo stock es mayor a su `min_stock` **cuando** consulto la sección "Alertas" **entonces** no aparece en el listado.
4. **Dado** un producto archivado (`active = false`) **cuando** consulto las alertas **entonces** no aparece, sin importar su nivel de stock.
5. **Dado** un escenario multitenant **cuando** consulto las alertas **entonces** solo veo las alertas de mi tenant (aislamiento probado en pgTAP).

## Modelo de datos y migraciones
Nueva vista `low_stock_alerts` para centralizar la lógica de negocio y simplificar las consultas del cliente.

```sql
CREATE OR REPLACE VIEW public.low_stock_alerts AS
WITH stock_por_producto AS (
  SELECT
    tenant_id,
    product_id,
    SUM(qty) AS total_qty
  FROM public.stock_movements
  WHERE tenant_id IN (SELECT public.user_tenant_ids())
  GROUP BY tenant_id, product_id
)
SELECT
  p.tenant_id,
  p.id AS product_id,
  p.sku,
  p.name,
  p.min_stock,
  COALESCE(s.total_qty, 0) AS total_qty
FROM public.products p
LEFT JOIN stock_por_producto s ON p.id = s.product_id AND p.tenant_id = s.tenant_id
WHERE p.tenant_id IN (SELECT public.user_tenant_ids())
  AND p.active = true
  AND p.min_stock > 0
  AND COALESCE(s.total_qty, 0) <= p.min_stock;

GRANT SELECT ON public.low_stock_alerts TO authenticated, service_role;
```

## Políticas RLS requeridas
- La vista `low_stock_alerts` se ejecuta sin `security_invoker` (usa privilegios del creador), por lo cual repite explícitamente `WHERE tenant_id IN (SELECT public.user_tenant_ids())` en la CTE y en la consulta principal, manteniendo el aislamiento multitenant estricto sin depender del `FORCE ROW LEVEL SECURITY` de las tablas subyacentes, corrigiendo preventivamente el bypass de rol del dueño (lección aprendida en S2-02).

## Funciones RPC e invariantes
- No aplica (solo lectura).

## Casos borde
- Producto con `min_stock = 0` (por defecto): no genera alerta.
- Producto recién creado sin movimientos (stock = 0) y `min_stock > 0`: debe aparecer en alertas. El uso de `LEFT JOIN` y `COALESCE` en la vista garantiza que se capture correctamente este caso.
- Rol `member`: las alertas solo exponen cantidades (`qty`), no hay costos ni valores financieros involucrados, por lo cual es seguro que cualquier usuario del tenant acceda a esta vista.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- La vista repite el aislamiento explícito por tenant.
- La tabla no filtra información restringida, por lo que cumple con los requerimientos base de confidencialidad intra-tenant.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2, 3, 4 | pgTAP | `supabase/tests/S2-05-alertas-stock.sql` | Identifica productos bajo mínimo (incluyendo productos sin movimientos), excluye los de stock suficiente, ignora `min_stock = 0` y productos inactivos (`active = false`). |
| 5 | pgTAP | `supabase/tests/S2-05-alertas-stock.sql` | Aislamiento cruzado entre 2 tenants. |

## Historial
- 2026-07-20 · creada (draft)
