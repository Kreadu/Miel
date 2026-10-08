---
id: S26-11
titulo: Orden de compra con cantidades por bodega
estado: implemented
depende_de: [S26-10, S28-01]
---

# S26-11 — Una orden, muchas bodegas

## Contexto y valor
Una sola orden al proveedor puede abastecer varias bodegas o sucursales. Hoy la bodega se elige
al recibir, para toda la factura. El humano quiere repartir en la orden cuánto de cada producto
va a cada bodega.

## Decisiones (aprobadas por el humano el 2026-10-08)
- **Formulario:** cada producto tiene una cantidad por bodega activa, en columnas. El total del
  producto es la suma. Con una sola bodega se ve una sola cantidad, como hoy.
- **Datos:** cada combinación producto + bodega con cantidad > 0 es un `purchase_items` con su
  `warehouse_id` (columna nueva; null en las órdenes viejas). `create_purchase` y
  `update_purchase` aceptan `warehouse_id` por ítem y validan que sea una bodega activa de la
  empresa.
- **PDF y WhatsApp:** el detalle va agrupado por bodega, con nombre y dirección de cada una.
- **Recibir:** cada línea muestra su bodega y el stock entra ahí. La factura ya no pide bodega
  (`purchase_invoices.warehouse_id` pasa a ser opcional), salvo que la orden tenga ítems viejos
  sin bodega. Anular una línea saca el stock de la bodega donde entró: la del movimiento.
- **Órdenes viejas:** sus ítems no tienen bodega y se reciben en la bodega de la factura, como
  hasta ahora.

## Criterios de aceptación
1. **Dado** una orden con Miel × Principal 20 y Miel × Norte 10 **entonces** quedan dos ítems con
   su bodega, y el total de la orden suma los dos.
2. **Dado** una bodega de otra empresa o inactiva en un ítem **entonces** la orden se rechaza
   (`warehouse_invalid`).
3. **Dado** una factura sin bodega **cuando** se reciben las dos líneas **entonces** entran 20 a
   Principal y 10 a Norte. Si la orden tiene ítems sin bodega, la factura sin bodega se rechaza.
4. **Dado** una línea de Norte anulada **entonces** el stock sale de Norte.
5. A 375px el formulario con varias bodegas no produce scroll horizontal del body: la grilla de
   cantidades tiene su propio scroll.

## Plan de tests
| Criterio | Tipo | Archivo |
|---|---|---|
| 1–4 | pgTAP | supabase/tests/S26-11-cantidades-por-bodega.sql |
| 1 | Vitest | src/app/(app)/compras/ordenes/warehouse-split.test.ts (expandir/agrupar) |
| PDF | Vitest | src/lib/purchases/pdf-data.test.ts (agrupado por bodega) |

## Historial
- 2026-10-08 · approved por el humano ("si aprobado").
- 2026-10-08 · implemented. Migración `20261008180000_cantidades-por-bodega.sql`;
  `src/lib/purchases/warehouse-split.ts`; el PDF agrupa por bodega ("Entregar en"). Cuando la
  orden sale desde Alertas, lo sugerido va a la bodega principal. pgTAP 11/11, solo en PGlite. Sin
  revisión visual ni a 375px.
