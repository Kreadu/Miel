---
id: S28-03
titulo: Corregir o anular una factura de proveedor y anular líneas sin descuadrar el costo
estado: implemented
depende_de: [S28-01, S28-02]
---

# S28-03 — Corregir o anular facturas; anulación de líneas con costo coherente

## Contexto y valor
Con S28-01, una factura mal escrita (número, fechas o total) queda fija. Ese total es la deuda
con el proveedor y va al estado de resultados, así que tiene que poder corregirse.

Además, anular una línea cuando ya se vendió parte de esas unidades puede dejar valor en el kardex
con stock 0. Pasa porque la salida va al costo de entrada y las ventas salieron al costo promedio.
Ese valor sobrante desvía el promedio de la compra siguiente. Las cifras tienen que ser
fidedignas.

## Supuestos (aprobados por el humano el 2026-10-08: "asumamos lo que dirá la contadora y hacer las dos cosas")
- **F0 · Método de costo:** promedio ponderado (ADR-038), asumido como respuesta de la contadora.
- **F1 · Corregir:** el dueño o un administrador cambia número, fechas, CUFE, subtotal, IVA y
  archivo de cualquier factura no anulada de una orden no cancelada. La bodega no se cambia: el
  stock ya entró ahí. Si la bodega estaba mal, se anulan las líneas y la factura y se ingresa de
  nuevo.
- **F2 · Anular:** el dueño o un administrador anula una factura sin líneas activas. La factura
  queda guardada como anulada (no se borra) y su número se puede volver a usar.
- **F3 · Deuda:** `invoiced_total` es la suma de las facturas no anuladas. Si no queda ninguna,
  la deuda vuelve a ser el total de la orden. Una corrección o anulación que deje la deuda de la
  orden por debajo de lo ya pagado se rechaza (`invoice_below_payments`).
- **F4 · Anulación de línea con costo coherente:** la salida va al costo de entrada, como en R6.
  Hay dos excepciones:
  - si con la salida el producto queda en 0 unidades, la salida lleva todo el valor que queda, de
    modo que el kardex queda en $0;
  - si al costo de entrada el valor quedaría negativo, la salida va al costo promedio.

## Alcance
- **BD:** migración nueva.
  - `purchase_invoices` gana las columnas `voided_at` y `voided_by`.
  - El índice único del número pasa a contar solo las facturas no anuladas.
  - RPC nuevas: `update_purchase_invoice` y `void_purchase_invoice`.
  - `create_purchase_invoice` y `void_purchase_receipt_line` se redefinen. Esta última aplica F4.
  - `receive_purchase_line` rechaza facturas anuladas.
  - Los cálculos de `invoiced_total` excluyen las facturas anuladas.
  - Valores nuevos de `activity_log`.
- **App:** en la lista de facturas de la recepción, "Corregir" abre el formulario precargado y
  "Anular" aparece solo si la factura no tiene líneas activas. La factura anulada se ve tachada.
  Textos es/en/fr.

## NO-alcance
- Cambiar la bodega de una factura.
- Notas crédito del proveedor y retenciones.
- PEPS.

## Criterios de aceptación
1. **Dado** la factura FE-123 por $8.568 **cuando** el dueño la corrige a FE-128 con IVA $1.400
   **entonces** queda con ese número y un total de $8.600, y la deuda de la orden y las cuentas
   por pagar dan $8.600. Un miembro o una empresa ajena reciben un rechazo.
2. **Dado** una factura sin líneas activas **cuando** el dueño la anula **entonces** sale de la
   deuda (sin otras facturas, la deuda vuelve al total de la orden), no admite líneas y su número
   se puede volver a usar. Una factura con líneas activas no se anula.
3. **Dado** un pago de $5.000 a la orden **cuando** la corrección o la anulación dejaría la deuda
   en menos de $5.000 **entonces** se rechaza y no cambia nada.
4. **Dado** 10 a $1.000 más 10 recibidas a $2.000 (promedio $1.500), con 15 vendidas al promedio
   **cuando** se anulan esas 10 **entonces** hay stock insuficiente (quedan 5).
   **Dado** 5 a $1.000 más 5 a $2.000, con 0 vendidas **cuando** se anula la línea de $2.000
   **entonces** sale a $2.000 y el costo vuelve a $1.000.
   **Dado** que se venden 5 al promedio de $1.500 (quedan 5, por $7.500) **cuando** se anula la
   línea de 5 a $2.000 **entonces** el producto queda en 0 unidades y $0, sin valor sobrante.
5. **Dado** un celular de 375px **entonces** corregir una factura no produce scroll horizontal.

## Funciones RPC e invariantes
- `update_purchase_invoice(p_invoice_id, p_number, p_issued_on, p_due_on, p_cufe, p_subtotal, p_tax, p_total, p_file_path)`
  (`p_file_path` null = conserva el archivo):
  - solo owner o admin;
  - la factura no está anulada y la orden no está cancelada;
  - mismas validaciones que la creación;
  - el número es único entre las facturas activas del proveedor;
  - deuda nueva ≥ lo pagado.
- `void_purchase_invoice(p_invoice_id)`:
  - solo owner o admin;
  - no tiene líneas activas;
  - deuda nueva ≥ lo pagado.

## Plan de tests
| Criterio | Tipo | Archivo |
|---|---|---|
| 1–4 | pgTAP | supabase/tests/S28-03-corregir-factura.sql |
| 1–2 | Vitest | src/actions/purchase-receipts.test.ts |
| 5 | manual | — |

## Historial
- 2026-10-08 · creada y approved por instrucción del humano en la sesión.
- 2026-10-08 · implemented. La deuda se recalcula en `refresh_purchase_invoiced_total`, que
  rechaza quedar por debajo de lo pagado. pgTAP 22/22, corridos solo en PGlite.
