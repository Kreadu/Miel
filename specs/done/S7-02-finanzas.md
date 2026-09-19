---
id: S7-02
titulo: P&L mensual, flujo de caja y rentabilidad
estado: implemented
depende_de: [S5-03, S7-01]
---

# S7-02 — P&L mensual, flujo de caja y rentabilidad

## Contexto y valor
Para poder tomar decisiones informadas sobre la rentabilidad del negocio, el gerente necesita herramientas visuales (vistas de base de datos) que agreguen la información transaccional de ventas, compras y gastos, y permitan entender los ingresos, márgenes y la disponibilidad de caja.

## Alcance
- Creación de vistas en base de datos para los reportes gerenciales: `monthly_pnl`, `cash_flow`, `product_profitability` y `monthly_expenses`.
- Las vistas deben agrupar por mes usando la zona horaria `'America/Bogota'` según ADR-018.
- Filtrado multitenant explícito en las vistas, igual que otras vistas del sistema.
- Restricción de acceso para asegurar que solo `owner` y `admin` pueden consultar estas vistas (según `permisos-roles.md`).

## NO-alcance (explícito)
- Construcción de las gráficas o la página de UI de Finanzas (esto se cubre en S7-03).
- Reportes exportables (Fase 2).

## Criterios de aceptación
1. **Dado** un `owner` o `admin`, **cuando** consulta `monthly_pnl`, **entonces** obtiene los ingresos, COGS y gastos agregados por mes ('YYYY-MM'), resultando en la utilidad neta correcta.
2. **Dado** un `owner` o `admin`, **cuando** consulta `cash_flow`, **entonces** obtiene el total de entradas (`customer_payments`) y salidas (`supplier_payments` + `expenses`) por mes.
3. **Dado** un `owner` o `admin`, **cuando** consulta `product_profitability`, **entonces** obtiene unidades vendidas, ingresos netos, costo total, y margen ($ y %) para cada producto vendido.
4. **Dado** un `owner` o `admin`, **cuando** consulta `monthly_expenses`, **entonces** obtiene el total de gastos por mes, desglosado por `category` y `kind`.
5. **Dado** un `member`, **cuando** intenta consultar cualquiera de estas vistas, **entonces** recibe error de permisos (`permission_denied`) o cero registros (aislamiento).

## Modelo de datos y migraciones
Vistas nuevas sin tablas subyacentes:
- `monthly_pnl`: agrupa `sales` (estados confirmados/despachados/entregados) para ingresos y COGS, y `expenses` para gastos, por mes.
- `cash_flow`: agrupa `customer_payments`, `supplier_payments` y `expenses` por mes.
- `product_profitability`: cruza `products` con `sale_items` (de ventas válidas) para agrupar ventas, COGS y márgenes.
- `monthly_expenses`: agrupa `expenses` por mes, `category` y `kind`.

## Políticas RLS requeridas
Las vistas bypassan RLS por defecto si se crean con permisos de dueño (postgres). Por lo tanto, cada vista **debe** incluir en su definición `WHERE tenant_id IN (SELECT public.user_tenant_ids()) AND public.user_is_tenant_admin(tenant_id)` (o equivalente `auth.uid()`) para forzar la autorización a nivel de fila y rol.
Solo roles `owner` y `admin` pueden ver los reportes ("member opera, no ve finanzas").

## Funciones RPC e invariantes
N/A (solo vistas de lectura).

## Casos borde
- Meses sin ingresos pero con gastos (o viceversa): la vista `monthly_pnl` y `cash_flow` deben usar un `FULL OUTER JOIN` u orquestar una tabla temporal/serie de fechas para no omitir el mes si falta alguno de los componentes.
- Divisiones por cero en `product_profitability` si el ingreso es 0 (ej: descuento 100%): debe manejarse con `nullif` o `greatest` para evitar excepciones SQL.

## Consideraciones de seguridad (docs/arch/seguridad.md)
Al ser vistas que exponen agregaciones financieras, la validación del tenant activo y el rol (owner/admin) dentro de la definición de la vista es mandatoria.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2, 3, 4 | pgTAP | supabase/tests/S7-02-finanzas.sql | Verifican los cálculos correctos de las 4 vistas con datos de prueba controlados. |
| 5 | pgTAP | supabase/tests/S7-02-finanzas.sql | Verifica que un `member` o usuario de otro tenant obtenga 0 filas en todas las vistas. |

## Historial
- 2026-07-20 · creada (draft)
- 2026-07-20 · auditoría pre-commit: la matriz de tests originalmente incumplía el criterio 5
  (solo `monthly_pnl` y `product_profitability` probaban aislamiento; `cash_flow` y
  `monthly_expenses` sin ningún test de rol/tenant) y los casos borde descritos (mes sin ventas,
  división por cero) no tenían fixture. Ampliado `supabase/tests/S7-02-finanzas.sql` de 7 a 15
  aserciones cubriendo las 4 vistas × aislamiento cross-tenant × rol `member`, más los 2 casos
  borde explícitos de la spec. Vistas de la migración sin cambios (correctas desde el inicio).
  Suite completa re-verificada de forma independiente: `npm run lint` ✓, `npx tsc --noEmit` ✓,
  `supabase db reset` (30 migraciones sin error) + `supabase test db` 331/331 pgTAP ✓ (antes 323,
  +8 netas), `database.types.ts` regenerado y diff'eado contra el commiteado — sin diferencias.
