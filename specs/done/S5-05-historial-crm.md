---
id: S5-05
titulo: Historial CRM de Cliente
estado: implemented
depende_de: [S5-04]
---

# S5-05 — Historial CRM de Cliente

## Contexto y valor
Para fidelizar y tomar decisiones informadas, los vendedores y gerentes necesitan ver la relación completa con un cliente en un solo lugar: su historial de ventas, sus pagos y sus promedios de compra.

## Alcance
- Vista `customer_history` con agregaciones sobre `sales` (`status in ('confirmed', 'shipped', 'delivered')`).
- Interfaz (Ficha de Cliente) con tarjetas de métricas: total compras, monto total, ticket promedio, fecha última compra.
- Línea de tiempo cronológica (ventas y pagos) para el cliente específico.

## NO-alcance (explícito)
- Interacciones directas del CRM (llamadas, quejas, seguimientos). Eso corresponde a la historia S5-07.

## Criterios de aceptación
1. **Dado** un cliente con ventas confirmadas y en borrador, **cuando** veo su historial, **entonces** los totales y promedios solo incluyen las ventas confirmadas.
2. **Dado** un cliente sin ventas, **cuando** veo su historial, **entonces** los totales son cero de forma segura sin arrojar errores.
3. **Dado** un miembro sin rol de admin, **cuando** ve el historial de un cliente, **entonces** puede ver las métricas del CRM sin restricción.
4. **Dado** dos clientes de distintos tenants, **cuando** un usuario consulta la vista, **entonces** solo ve los clientes de su tenant y no ocurre cruce de datos.

## Modelo de datos y migraciones
- Vista `customer_history`: Derivada de `customers` y `sales`. Expondrá: `tenant_id, customer_id, customer_name, doc_type, doc_number, total_sales_count, total_sales_amount, last_sale_at, average_ticket`.

## Políticas RLS requeridas
- `customer_history` usará un `WHERE tenant_id IN (SELECT user_tenant_ids())` explícito en la vista para asegurar el aislamiento. Todos los roles (owner, admin, member) pueden verla.

## Funciones RPC e invariantes
- N/A (Solo lectura).

## Casos borde
- El ticket promedio puede originar una división por cero si el cliente no tiene ventas (se previene en SQL con `coalesce` sobre el join/cuenta).

## Consideraciones de seguridad (docs/arch/seguridad.md)
- La ruta `/(app)/ventas/clientes/[id]` debe validar que el `[id]` pertenezca al tenant activo para evitar *Insecure Direct Object Reference (IDOR)*, ya sea al consultar directamente por RLS o mediante validación de servidor.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2, 3, 4 | pgTAP | supabase/tests/S5-05-historial-crm.sql | Aislamiento, cálculo correcto (solo confirmadas), manejos de nulos. |

## Historial
- 2026-07-20 · creada y approved.
- 2026-07-20 · implementada (pgTAP en verde: 8/8; tsc y lint limpios).
