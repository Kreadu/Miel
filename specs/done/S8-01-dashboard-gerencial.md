---
id: S8-01
titulo: Dashboard Gerencial - Métricas clave
estado: implemented
depende_de: [S2-04, S4-02, S7-02]
---

# S8-01 — Dashboard Gerencial - Métricas clave

## Contexto y valor
El gerente necesita tener una visión rápida y consolidada de la salud financiera y operativa de su empresa. Las tarjetas de métricas en el dashboard principal permiten ver ventas, utilidad, valor del inventario, cuentas por cobrar (CxC) y cuentas por pagar (CxP) de un vistazo para la toma rápida de decisiones.

## Alcance
- Creación de una vista o RPC en base de datos (`dashboard_metrics`) para consolidar de forma eficiente los indicadores principales del mes en curso y valores actuales (ventas del mes, utilidad bruta del mes, valor total de inventario en bodega, saldos pendientes por cobrar y por pagar).
- Tarjetas resumen en la UI del dashboard principal (`src/app/(app)/page.tsx` o similar) integrando estas métricas.
- Enlaces rápidos desde las tarjetas hacia los módulos de detalle (Finanzas, Cuentas por Cobrar, Cuentas por Pagar, Inventario).

## NO-alcance (explícito)
- Gráficas complejas (ya se hicieron en S7-03).
- Top de productos vendidos o rentables y alertas de stock (eso es parte de la S8-02).
- Dashboard dinámico o personalizable por el usuario.
- Comparativas porcentuales respecto al mes anterior (dejamos el scope lo más sencillo y directo posible para MVP).

## Criterios de aceptación
1. **Dado** un `owner` o `admin` logueado, **cuando** visita el dashboard (`/`), **entonces** ve las tarjetas de resumen: Ventas del mes, Utilidad, Valor de inventario, CxC y CxP con valores precisos (agrupando la data correctamente por tenant).
2. **Dado** un `member`, **cuando** visita el dashboard, **entonces** se le deniega el acceso a métricas financieras confidenciales según su perfil (solo debe ver información operativa pertinente o un empty state).
3. **Dado** un `owner`, **cuando** consulta el dashboard, **entonces** se lanza máximo 1 query o un request agrupado sin N+1 para obtener los agregados (consultas eficientes).
4. **Dado** que hay enlaces en las tarjetas, **cuando** se hace click en uno, **entonces** redirige correctamente al submódulo de origen (ej. `/finanzas`, `/ventas/cuentas-por-cobrar`, `/compras/cuentas-por-pagar`).

## Modelo de datos y migraciones
- Creación de vista SQL `dashboard_metrics` que agrega los datos de:
  - Ventas y utilidad del mes actual (basado en lógica de `monthly_pnl`).
  - Total de `current_stock * unit_cost` (para valor de inventario).
  - Total balance adeudado en `customer_balances` (CxC).
  - Total balance adeudado en `supplier_balances` (CxP).

## Políticas RLS requeridas
- `dashboard_metrics`: Filtro explícito `where tenant_id in (select public.user_tenant_ids())`. Validar adicionalmente el rol (`user_is_tenant_admin(tenant_id)`), para prevenir lectura por miembros en caso de que la vista exponga métricas sensibles globales.

## Funciones RPC e invariantes
- N/A. Solo consulta de datos, sin transacciones o invariantes para modificar estado.

## Casos borde
- Un nuevo tenant sin transacciones: las métricas deben devolver `0` sin lanzar error de divisón por cero ni nulls en UI.
- Rol `member` intentando acceder a la vista subyacente.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- La UI debe verificar que el usuario sea `admin/owner` para renderizar o realizar el `fetch`.
- Los datos de entrada del mes (si se parametrizaran en un futuro) deben ser cacheados y validados.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2, 3 | pgTAP | `supabase/tests/S8-01-dashboard.sql` | Cálculos agregados precisos, aislamiento de tenant y prohibición a `member`. |
| 4 | Vitest | N/A | UI estática evaluada manualmente o con snapshot, no requiere vitest estricto. |

## Historial
- 2026-07-20 · creada (draft)
