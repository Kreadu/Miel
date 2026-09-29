---
id: S19-35
titulo: Forma de entrega en el pedido (retiro, envío gratis, acordado, transporte por peso y km)
estado: implemented
depende_de: [S19-06, S19-08]
---

# S19-35 — Formas de entrega

## Contexto y valor

Pedido del humano 2026-09-29: en Pedidos, después del total a pagar y antes de pagar, elegir la
forma de entrega: retiro en tienda, envío gratis en la ciudad, envío acordado con el cliente o
envío por transporte (3 opciones con valor según peso y lejanía); luego un nuevo total, la forma
de pago y el cliente. Decisiones del humano: tarifas propias (no APIs de transportadoras), km
escritos en el pedido, tarifas en Vender → Envíos.

## Alcance

- Migración `20260929183359_formas-de-entrega.sql`: `products.weight_kg`; tabla
  `shipping_rates` (base, por kg, por km; RLS select tenant / escritura admin); `sales`
  gana `delivery_method`, `shipping_rate_id`, `shipping_km`, `shipping_cost`; `create_sale`
  recibe la entrega y **calcula el costo del transporte en la BD** (base + kg·peso + km·km; el
  "acordado" es a mano); `total = subtotal + IVA + envío`.
- `/ventas/envios`: crear, editar y eliminar transportes. Acceso desde Vender.
- Producto (inventario de productos): campo Peso (kg).
- Carrito de Pedidos: Total a pagar → Forma de entrega (4 botones; acordado pide monto;
  transporte pide km y muestra un valor por transporte con el peso del pedido) → Envío + Total
  con envío → Forma de pago → Cliente. "Confirmar pedido" exige elegir forma de entrega.
- `SaleForm` (pedido manual sin carrito) sin cambios: la entrega es opcional en la BD.

## NO-alcance

- APIs de transportadoras; cálculo de km por dirección; límite de 3 transportes (se muestran
  todos los configurados); mostrar la entrega en el listado de pedidos.

## Tests

- pgTAP `supabase/tests/S19-35-formas-de-entrega.sql`. Vitest `src/lib/shipping.test.ts`,
  `src/actions/sales.test.ts`.
