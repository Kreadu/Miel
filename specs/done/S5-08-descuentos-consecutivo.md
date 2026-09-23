---
id: S5-08
titulo: Descuentos por ítem y numeración consecutiva de recibos
estado: implemented         # draft → approved → implemented
depende_de: [S5-03]
---

# S5-08 — Descuentos por ítem y numeración consecutiva de recibos

## Contexto y valor
El ciclo de ventas (S5-02/03) ya crea y confirma ventas, pero no permite descontar precio por
línea de forma trazable ni numera los recibos. Ambos son requisitos de un POS real (ADR-017):
descuentos de mostrador son una fuga clásica si se ocultan editando el precio, y todo punto de
venta necesita una numeración consecutiva de sus documentos. Es la primera pieza del POS
(S5-08…S5-10), antes de caja (S5-09) y venta rápida (S5-10).

## Alcance
- `create_sale` acepta y valida `discount` (monto) por ítem; los totales de la cabecera
  (`subtotal`/`tax`/`total`) se calculan netos de descuento.
- `confirm_sale` asigna `receipt_number` consecutivo por tenant, sin huecos ni duplicados bajo
  confirmaciones concurrentes, vía tabla contador `sale_counters`.
- UI: captura de descuento **por porcentaje** en el formulario de venta (convertido a monto antes
  de enviar); listado de ventas muestra "Recibo #N" en ventas confirmadas.

## NO-alcance (explícito)
- Descuento global de venta (solo por ítem, ver ADR-017).
- Reporte de descuentos otorgados en Finanzas (queda para S7-03).
- Cambiar el descuento de una venta ya confirmada (fuera de alcance; edición de ítems solo aplica
  a `draft`, ya cubierto por el flujo existente de S5-02).
- Reset o reinicio anual del consecutivo (Fase 2, si el negocio lo pide).

## Criterios de aceptación
1. **Dado** una venta en borrador con un ítem de `qty=2, unit_price=100` **cuando** se crea con
   `discount=20` en ese ítem **entonces** el ítem persiste `discount=20` y el `subtotal` de la
   cabecera refleja la base neta (`180`), no la bruta (`200`).
2. **Dado** un ítem con `discount` mayor al valor de la línea (`qty·unit_price`) **cuando** se
   intenta crear la venta **entonces** la operación falla con `item_discount_invalid` y no se crea
   ninguna fila (todo o nada).
3. **Dado** un tenant sin ventas confirmadas previas **cuando** se confirma una venta **entonces**
   `receipt_number = 1`; **cuando** se confirma una segunda venta **entonces** `receipt_number = 2`
   (sin huecos, sin duplicados, incluso si ambas confirmaciones ocurren concurrentemente).
4. **Dado** dos tenants distintos **cuando** cada uno confirma su primera venta **entonces** ambos
   reciben `receipt_number = 1` (secuencias independientes) y ninguno puede ver ni afectar el
   contador del otro.
5. **Dado** una venta en `draft` **cuando** se consulta **entonces** `receipt_number` es `null`
   (se asigna únicamente al confirmar).

## Modelo de datos y migraciones
Referencia: `docs/data-model.md` (E5). Columnas destino ya existen desde S5-02
(`sales.receipt_number integer`, `sale_items.discount numeric(14,2) default 0`); esta historia
les da lógica, no las crea.

Migración nueva `supabase/migrations/<ts>_sale_discounts_receipts.sql`:
- Tabla nueva `sale_counters (tenant_id uuid primary key references tenants(id), last_no integer
  not null default 0)` — contador atómico del consecutivo, un registro por tenant.
- Índice único parcial `sales_tenant_receipt_key on sales (tenant_id, receipt_number) where
  receipt_number is not null` — red de seguridad contra duplicados aunque falle la lógica del RPC.
- `create or replace function create_sale(...)` (misma firma): lee `discount` de cada ítem del
  jsonb, lo valida y lo persiste; recalcula `subtotal`/`tax` sobre la base neta.
- `create or replace function confirm_sale(...)` (misma firma): asigna `receipt_number` vía
  upsert atómico sobre `sale_counters` antes de marcar `status = 'confirmed'`.

## Políticas RLS requeridas
`sale_counters`: RLS habilitada, una política `select` por tenant (`tenant_id in (select
user_tenant_ids())`), **sin política de insert/update/delete** — toda escritura entra por
`confirm_sale` (`security definer`), mismo patrón "solo lectura + RPC" ya usado en
`stock_movements`/`purchases`/`sales`. `GRANT SELECT` explícito a `authenticated, service_role`.
`sales`/`sale_items` no cambian sus políticas existentes (siguen solo-lectura por RLS, escritura
por `create_sale`/`confirm_sale`).

## Funciones RPC e invariantes
- `create_sale(p_tenant_id, p_items, p_customer_id, p_note)` — invariantes nuevos: por ítem,
  `0 ≤ discount ≤ qty·unit_price` (`item_discount_invalid` si se viola); totales de cabecera
  calculados netos de descuento, nunca en TypeScript.
- `confirm_sale(p_sale_id, p_warehouse_id)` — invariante nuevo: `receipt_number` asignado exactamente
  una vez por venta confirmada, consecutivo y sin huecos por tenant, incluso bajo concurrencia
  (el upsert sobre `sale_counters` con `on conflict ... do update` es atómico a nivel de fila;
  no requiere `for update` adicional porque el propio `insert ... on conflict` serializa).

## Casos borde
- `discount = 0` (default): comportamiento idéntico al actual, sin regresión.
- `discount = qty·unit_price` exacto (línea gratis): válido, límite inclusivo.
- Venta cancelada en `draft` (nunca confirmada): no consume ningún número de la secuencia.
- Rollback de `confirm_sale` por cualquier otra causa (ej. stock insuficiente detectado a mitad de
  los ítems): el incremento del contador se revierte con la transacción — sin huecos.
- Tenant nuevo sin fila en `sale_counters`: el `insert ... on conflict` la crea con `last_no = 1`
  en la primera confirmación, sin necesidad de sembrarla al crear el tenant.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Boundary de servidor: `saleItemSchema` (Zod) valida forma de `discount` en `src/actions/sales.ts`
  antes de invocar la RPC; la RPC revalida invariantes de negocio (defensa en profundidad, ninguna
  confía solo en la otra).
- Errores internos no llegan al cliente: `mapSaleError` en `src/actions/sales.ts` traduce
  `item_discount_invalid` a un mensaje genérico en español, sin exponer detalle de la excepción SQL.
- `sale_counters` no expone datos sensibles distintos a los ya visibles en `sales` (es solo un
  contador entero); aislamiento por tenant igual que el resto del esquema.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S5-08-descuentos-consecutivo.sql | subtotal/tax/total netos de descuento tras `create_sale` |
| 2 | pgTAP | supabase/tests/S5-08-descuentos-consecutivo.sql | `item_discount_invalid` cuando discount > línea; nada se crea |
| 3 | pgTAP | supabase/tests/S5-08-descuentos-consecutivo.sql | dos confirmaciones consecutivas del mismo tenant → receipt_number 1, 2 |
| 4 | pgTAP | supabase/tests/S5-08-descuentos-consecutivo.sql | dos tenants, ambos arrancan en 1; aislamiento de `sale_counters` |
| 5 | pgTAP | supabase/tests/S5-08-descuentos-consecutivo.sql | venta en draft tiene receipt_number null |
| — | Vitest | src/lib/validation/sales.test.ts | `discount` default 0, rechaza negativo, coerciona string→number |

## Historial
- 2026-07-20 · creada y aprobada en la misma sesión (draft → approved): mecánica de descuento
  (porcentaje en UI → monto en BD) y consecutivo (tabla contador por tenant) confirmadas
  explícitamente con el humano antes de redactar, vía `AskUserQuestion` en fase de planificación.
- 2026-07-20 · implementada con TDD (approved → implemented): pgTAP y Vitest escritos primero y
  verificados en rojo; migración después, verde tras un solo ajuste de fixture (no de RPC): dentro
  de una misma transacción de test `now()` es constante, así que ordenar por `issued_at`/`created_at`
  no distingue entre dos confirmaciones sucesivas del mismo tenant — se capturaron los ids de cada
  venta en tablas temporales antes de confirmar. Suite completa 260/260 pgTAP, 111/111 Vitest.
