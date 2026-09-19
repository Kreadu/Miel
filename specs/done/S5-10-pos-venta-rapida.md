---
id: S5-10
titulo: Pantalla POS de venta rápida (register_pos_sale)
estado: implemented         # draft → approved → implemented
depende_de: [S5-08, S5-09]
---

# S5-10 — Pantalla POS de venta rápida

## Contexto y valor
Última pieza del POS (ADR-017) y de la Épica 5. Con descuentos/consecutivo (S5-08) y caja/arqueo
(S5-09) en `done`, faltaba la venta de **mostrador en un solo paso**: crear la venta, confirmarla
(salida de stock + costo congelado + recibo consecutivo), cobrarla y ligarla al turno de caja
abierto — todo atómico. Hoy ninguna RPC escribe `sales.cash_session_id` ni
`customer_payments.cash_session_id`, así que el arqueo de S5-09 nunca ve efectivo real; esta
historia los puebla por primera vez y cierra el ciclo POS.

## Alcance
- RPC `register_pos_sale` atómica que **reutiliza** `create_sale` (ítems + descuentos + totales) y
  `confirm_sale` (stock + costo congelado + consecutivo), liga la venta y los cobros a la sesión de
  caja abierta del usuario, y registra los pagos (mixtos permitidos).
- `customer_payments.customer_id` pasa a **nullable** (ALTER forward-only) para soportar el cobro
  de mostrador anónimo ligado a caja (cuenta en el arqueo).
- Pantalla `/ventas/pos`: selección rápida de productos con cantidad y descuento (%), un método de
  pago por el total, botón "Cobrar". Exige caja abierta; si no la hay, invita a abrirla.

## NO-alcance (explícito)
- UI de pagos divididos (varias líneas de pago): la RPC acepta el array mixto, pero la UI captura un
  solo método por el total (Fase 2 si el negocio lo pide).
- Venta a crédito desde el POS (Σ pagos < total): el POS cobra el total completo; los abonos
  parciales siguen por `register_customer_payment` (S5-04) en `/ventas/pedidos`.
- Devoluciones / anulación de ticket (Fase 2, ADR-017).
- Reportes de descuentos y de caja en Finanzas (S7-03).

## Criterios de aceptación
1. **Dado** un usuario con caja abierta **cuando** invoca `register_pos_sale` con ítems y un pago en
   efectivo igual al total **entonces** se crea una venta `confirmed` con `receipt_number` asignado,
   sale el stock, se congela `unit_cost`, `sales.cash_session_id` = la sesión abierta, y se inserta
   un `customer_payments` con `cash_session_id`, `method='cash'` (y `customer_id null` si es
   mostrador).
2. **Dado** un usuario **sin** caja abierta **cuando** invoca `register_pos_sale` **entonces** falla
   con `pos_no_open_session` y no se crea nada.
3. **Dado** ítems cuyo total ≠ Σ pagos **cuando** invoca `register_pos_sale` **entonces** falla con
   `pos_payment_mismatch` y no queda venta, ítems, movimientos ni pagos (todo o nada).
4. **Dado** stock insuficiente en un ítem **cuando** invoca `register_pos_sale` **entonces** falla
   con `stock_insufficient`, se revierte todo y **no se consume número de recibo** (secuencia sin
   huecos).
5. **Dado** pagos mixtos (efectivo + tarjeta) que suman el total **cuando** invoca
   `register_pos_sale` **entonces** la venta se registra y solo la porción `cash` cuenta en el
   `expected_amount` del arqueo posterior (`close_cash_session`).

## Modelo de datos y migraciones
Referencia: `docs/data-model.md` (E5). No hay tablas nuevas. Migración nueva
`supabase/migrations/<ts>_pos_sale.sql`:

- `alter table public.customer_payments alter column customer_id drop not null;` — el cobro de
  mostrador anónimo queda con `customer_id null` + `cash_session_id`. No rompe `customer_balances`
  (LEFT JOIN desde `customers`: los pagos sin cliente no cuentan a ningún saldo) ni
  `close_cash_session` (suma por `cash_session_id`+`method`). La FK `on delete restrict` se mantiene.
- `register_pos_sale(p_tenant_id, p_warehouse_id, p_items jsonb, p_payments jsonb, p_customer_id
  default null, p_note default null) returns uuid` (`security definer`, `set search_path = public`).

## Políticas RLS requeridas
Ninguna tabla nueva ni política nueva. `sales`/`sale_items`/`customer_payments` conservan su patrón
"solo lectura por RLS + escritura por RPC". El ALTER de `customer_id` no cambia políticas. La RPC no
exige rol admin (matriz `permisos-roles.md`: crear ventas / POS es ✔ para owner/admin/member).

## Funciones RPC e invariantes
`register_pos_sale` — reutiliza las invariantes de `create_sale` (descuento válido por ítem,
producto activo del tenant, ítems no vacíos) y `confirm_sale` (bodega del tenant, stock ≥ 0, recibo
consecutivo sin huecos). Invariantes propias:
- El usuario tiene una sesión de caja `open` en el tenant (`pos_no_open_session`).
- Pagos no vacíos; cada `method in ('cash','transfer','card','other')` y `amount > 0`
  (`pos_payment_invalid`).
- `round(Σ amount, 2) = round(sales.total, 2)` (`pos_payment_mismatch`).
- Atomicidad total: cualquier fallo revierte venta, ítems, movimientos, recibo y pagos.

## Casos borde
- Venta de mostrador sin cliente: `p_customer_id null` → venta y pagos con `customer_id null`.
- Un solo pago por el total (caso UI): `p_payments` de un elemento; validación Σ=total igual.
- Comparación Σ=total redondeada a 2 decimales para no fallar por ruido de `numeric`; la UI computa
  el total con la misma fórmula ya usada en `sale-form.tsx` (base neta de descuento + IVA).
- Pago con método distinto de efectivo: se registra, cuenta en `cash_session_summary` por método,
  pero no en `expected_amount` (solo `cash`).
- Stock insuficiente a mitad de los ítems: rollback completo, contador de recibo intacto (S5-08).

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Boundary de servidor: `posSchema` (Zod) valida forma en `src/actions/pos.ts` antes de invocar la
  RPC; la RPC revalida invariantes de negocio (defensa en profundidad).
- Errores internos no llegan al cliente: `mapPosError` traduce cada código a mensaje genérico en
  español.
- Autorización real en RLS + `security definer` con validación explícita de `user_tenant_ids()`; el
  `tenant_id` lo resuelve el servidor (`getActiveTenant`), nunca el cliente, y la RPC lo revalida.
- Inserts con columnas explícitas (sin spread del input).

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S5-10-pos.sql | venta `confirmed` + recibo + stock out + costo congelado + `cash_session_id` en venta y pago |
| 2 | pgTAP | supabase/tests/S5-10-pos.sql | sin sesión abierta → `pos_no_open_session`, nada creado |
| 3 | pgTAP | supabase/tests/S5-10-pos.sql | Σ pagos ≠ total → `pos_payment_mismatch`, atomicidad (0 filas) |
| 4 | pgTAP | supabase/tests/S5-10-pos.sql | stock insuficiente → rollback, recibo no consumido |
| 5 | pgTAP | supabase/tests/S5-10-pos.sql | pagos mixtos suman total; `close_cash_session` esperado = base + cash |
| — | pgTAP | supabase/tests/S5-10-pos.sql | aislamiento de tenant: usuario ajeno no registra contra este tenant/sesión |
| — | Vitest | src/lib/validation/pos.test.ts | `posSchema`: método válido, items min 1, coerción de números |

## Historial
- 2026-07-20 · creada y aprobada (draft → approved): decisiones de diseño confirmadas con el humano
  vía AskUserQuestion antes de redactar — `customer_payments.customer_id` nullable (cobro de
  mostrador anónimo cuenta en el arqueo), UI de un solo método de pago (RPC soporta mixto para Fase
  2), y `register_pos_sale` como composición de `create_sale`+`confirm_sale` (cero duplicación).
- 2026-07-20 · implementada con TDD (approved → implemented): pgTAP (14 tests) y Vitest (4 tests)
  escritos primero; migración `20260720205039_pos_sale.sql` después, verde al primer intento
  (292/292 pgTAP, 123/123 Vitest). Auditoría pre-commit corrigió un blocker de UI: la opción
  "Mostrador" usaba `<SelectItem value="">` (Radix lo prohíbe → crash) — reemplazada por el sentinel
  `__counter__` normalizado en la Server Action, mismo patrón que `sale-form`.
