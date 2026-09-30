---
id: S18-07
titulo: Cobro simple en "Pedidos por completar" — la forma de pago en un solo lugar
estado: implemented
depende_de: [S18-06]
---

# S18-07 — Cobro simple en Pedidos por completar

## Contexto

Pedido del humano (2026-09-30), pensando en personas con muy poca práctica en el computador: la
forma de pago salía dos veces en cada pedido ("Pago: Efectivo" bajo el estado, y otra vez en
"Registrar cobro", que además venía siempre en Efectivo y pedía escribir el monto). "Cancelar"
(cerrar el formulario) y "Anular venta" (deshacer la venta) se confundían. Aprobado tal cual se
propuso ("dale").

## Alcance (solo pantalla, sin BD)

- Se quita la línea "Pago: …" bajo el estado.
- Con forma de pago elegida en el carrito: botón **"Cobrar $saldo en <forma>"** — un clic cobra
  el saldo completo — y enlace chico **"cambiar forma de pago"**.
- Sin forma de pago elegida (o al cambiarla): **"¿Cómo paga?"** con 4 botones grandes (Efectivo,
  Tarjeta, Transferencia, Otro) y el monto ya puesto en el saldo (se puede bajar para un abono).
  Un clic en la forma de pago cobra.
- "Cancelar" de los formularios de la fila pasa a **"Volver"**.
- "Anular venta" queda abajo, separado, en rojo (sigue pidiendo confirmación).
- Textos es/en/fr.

## Criterios

- La forma de pago aparece una sola vez por pedido.
- Cobrar el saldo con la forma elegida en el carrito = 1 clic.
- Un error del cobro se muestra traducido y no cierra el formulario.
- Lint, tsc, `npm test`; navegador del humano.

## Notas de implementación

- `payment-form.tsx` reescrito (sin Select: 4 botones grandes); `sale-row.tsx` sin la línea
  "Pago: …" y con "Anular venta" separada. Claves nuevas `sales.orders.{chargeWith, charge,
  charging, changeMethod, howPays, amount}`; `sales.orders.cancel` = "Volver"; borradas las que
  quedaron sin uso (`registerPayment`, `maxAmount`, `methodPlaceholder`, `collect`, `payment`).
- Hallazgo al cerrar (lo reportó el humano como requisito nuevo): los cobros no llegan a la
  caja — ver S18-08.
