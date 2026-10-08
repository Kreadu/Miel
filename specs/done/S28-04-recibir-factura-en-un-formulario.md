---
id: S28-04
titulo: Recibir la factura en un solo formulario (totales calculados de lo que llegó y reparto por bodega)
estado: implemented
depende_de: [S28-01, S28-02, S28-03, S26-11]
---

# S28-04 — Recibir la factura en un solo formulario

## Contexto
Con S28-01 la factura pedía subtotal, IVA y total arriba, antes de saber qué llegó, y luego se
guardaba línea por línea. El humano pidió el 2026-10-08 que los totales se calculen de lo que
llegó, abajo del todo, y que se pueda repartir lo recibido entre bodegas en el mismo paso.

## Decisiones (aprobadas por el humano el 2026-10-08)
1. **Arriba:** número, fecha, vencimiento, CUFE (opcional) y archivo, sin montos.
2. **Por producto de la orden con pendiente:**
   - "Llegó", lleno con lo pendiente; con 0 no se recibe;
   - bodega, que viene la de la orden;
   - "+ Repartir en otra bodega";
   - costo sin IVA e IVA %, que vienen los de la orden;
   - precio de venta propuesto con el mismo % (S28-02).
   Un miembro solo ve cantidades y bodegas: entra al costo de la orden.
3. **Abajo, los totales que se van sumando:** subtotal sin IVA, IVA y total de lo que llegó.
   Debajo, "La orden esperaba $X · llega $Y · queda pendiente $Z".
4. **Un botón, "Guardar factura y recibir":** la RPC `receive_purchase_invoice` crea la factura
   con los totales calculados en la BD a partir de las líneas y recibe cada línea en su bodega.
   Es atómica: si algo falla, no queda nada.
5. **Lo que no llegó** queda pendiente, con "Queda pendiente" o "Cerrar con faltantes", igual que
   en S28-01.
6. **Se quitan de la UI** el formulario de factura con montos y "Guardar línea". "Corregir" (S28-03)
   sigue para ajustar los montos si la factura impresa trae otro valor, por ejemplo un flete.
7. **`receive_purchase_line`** gana `p_warehouse_id` (opcional): una bodega activa de la empresa
   que reemplaza la del ítem.

## Criterios de aceptación
1. **Dado** una orden de 10 A (Principal) a $1.000 + IVA 19 % y 5 B (Norte) **cuando** llegan
   6 A a $1.200, repartidas 4 en Principal y 2 en Norte, y 0 B **entonces**:
   - la factura queda con subtotal $7.200, IVA $1.368 y total $8.568;
   - entran 4 A en Principal y 2 A en Norte;
   - la orden queda en recibida parcial.
2. **Dado** sin líneas con cantidad, más de lo pendiente sumando el reparto, una bodega ajena o
   un número repetido **entonces** se rechaza y no queda ni la factura ni el stock.
3. **Dado** un miembro **entonces** entra al costo de la orden.
4. **Dado** un celular de 375px **entonces** el formulario se ve en tarjetas, sin scroll
   horizontal.

## Tests
- pgTAP: `supabase/tests/S28-04-recibir-factura.sql`.
- Vitest: totales de lo recibido y la acción.

## Historial
- 2026-10-08 · approved por el humano ("si").
- 2026-10-08 · implemented. Cambios:
  - migración `20261008200000_recibir-factura-en-un-formulario.sql`;
  - `ReceiveInvoiceForm`;
  - la acción `receivePurchaseInvoice` reemplaza a `createPurchaseInvoice` y `receivePurchaseLine`
    (se borraron, junto con `ReceiveLineForm`);
  - `InvoiceForm` queda solo para "Corregir";
  - el aviso de diferencia contra la orden compara la orden con lo que llega.

  pgTAP 13/13, solo en PGlite. Sin revisión visual.
