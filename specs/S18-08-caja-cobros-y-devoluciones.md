---
id: S18-08
titulo: Todo cobro entra a la caja; devolución de venta cobrada desde Caja
estado: spec-ready
depende_de: [S18-06, S18-07, S23-01]
---

# S18-08 — Caja: cobros y devoluciones

## Contexto

Hallazgo (2026-09-30): `register_customer_payment` nunca liga el cobro a la caja abierta, así que
los cobros de Pedidos y de "Cobrar y entregar" no cuentan en el cierre; en cambio la devolución
de `cancel_sale` sí se descuenta de la caja → el cierre queda descuadrado.

Decisiones del humano:
- El dinero cobrado va directo a la caja y ahí queda, sin que nadie lo edite.
- Una venta se puede **anular antes de cobrarla** (desde Pedidos, como hoy).
- Una venta **ya cobrada** no se anula desde Pedidos: si hubo un error y el cliente devuelve el
  producto, se hace una **devolución desde Caja** que saca el dinero de la caja (queda registrado,
  con motivo) y reingresa el producto al stock. Así cuadran caja y stock.

## Alcance

1. **Cobro → caja:** nueva versión de `register_customer_payment`: todo cobro queda ligado a la
   caja abierta de quien cobra (con su forma de pago). **Efectivo exige caja abierta**
   (`cash_session_required`); tarjeta/transferencia/otro se ligan si hay caja abierta.
2. **Anular solo sin cobros:** `cancel_sale` rechaza una venta con cobros
   (`sale_has_payments`) → mensaje "Esta venta ya fue cobrada: haz la devolución desde Caja".
3. **Devolución desde Caja** — RPC `refund_sale(p_receipt_number, p_reason)`:
   - Solo **dueño o administrador**, con **su caja abierta**.
   - Venta completa (supuesto: la devolución parcial de un solo producto queda para después).
   - Reingresa todo al stock (al costo congelado de la venta), registra la devolución del dinero
     por cada forma de pago ligada a la caja de quien devuelve, guarda motivo, fecha y quién, y
     deja la venta anulada.
   - Motivo obligatorio.
4. **Pantalla de Caja:**
   - Detalle del turno (solo lectura): cada cobro y devolución con hora, cliente, forma de pago,
     monto y quién.
   - Totales del turno por forma de pago (efectivo, tarjeta, transferencia, otro).
   - Para dueño/administrador: **"Devolver una venta"** — número de boleta + motivo → muestra la
     venta (cliente, total, productos) y pide confirmar.
5. Textos es/en/fr.

Fuera de alcance: devolución parcial, "ajustes de caja" libres (no hacen falta: nadie edita cobros).

## Criterios

- Un cobro en efectivo sin caja abierta: error "Abre tu caja…" y nada guardado.
- Cobro con caja abierta: aparece en el detalle del turno y en lo esperado del cierre (efectivo).
- "Cobrar y entregar" (S18-06) también suma a la caja.
- "Anular venta" en una venta cobrada: error que manda a Caja; sin cobros sigue funcionando.
- Devolución: solo owner/admin con caja abierta; stock vuelve a la bodega de la venta; la caja
  muestra la salida con motivo; la venta queda anulada; nada queda a medias si algo falla.
- Nadie puede editar ni borrar cobros ni devoluciones (sin políticas de escritura).
- pgTAP: cobro ligado a caja, efectivo sin caja, anular con cobros, devolución (feliz,
  operativo rechazado, sin caja, motivo vacío, atomicidad, tenant ajeno). Vitest de acciones.
- Lint, tsc, `npm test`; migración y pgTAP los aplica/corre el humano.
