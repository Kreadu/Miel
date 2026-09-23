---
id: S5-06
titulo: Despacho y entrega de ventas
estado: implemented
depende_de: [S5-03]
---

# S5-06 — Despacho y entrega de ventas

## Contexto y valor
Una vez confirmada una venta, el siguiente paso lógico es su despacho y posterior entrega al cliente, o bien su entrega inmediata si es una venta de mostrador. Se deben rastrear los cambios de estado y las fechas para dar visibilidad al negocio.

## Alcance
- RPC `mark_sale_shipped(p_sale_id, p_shipping_address)`: requiere estado `confirmed` y una dirección válida; transiciona a `shipped` con `shipped_at = now()`.
- RPC `mark_sale_delivered(p_sale_id)`: transiciona a `delivered` con `delivered_at = now()`. Permite el salto directo desde `confirmed` para ventas de mostrador, y desde `shipped` para ventas con envío.
- Componentes UI integrados en la fila de la venta (`sale-row.tsx`) para invocar estas acciones según el estado.

## Criterios de aceptación
1. **Dado** una venta en estado `confirmed` **cuando** se invoca el despacho con una dirección **entonces** el estado cambia a `shipped` y guarda la dirección.
2. **Dado** una venta en estado `shipped` **cuando** se marca como entregada **entonces** el estado cambia a `delivered`.
3. **Dado** una venta en estado `confirmed` (ej. mostrador) **cuando** se marca como entregada directamente **entonces** el estado cambia a `delivered` (salto válido).
4. **Dado** un intento de despachar o entregar sin pertenecer al tenant **entonces** falla por RLS.
5. **Dado** un intento de despachar una venta no confirmada o sin dirección **entonces** la operación es rechazada de forma segura.

## Plan de tests
Test `supabase/tests/S5-06-despachos.sql` (pgTAP) verificando el flujo lineal, el flujo de mostrador (salto), aislamientos multitenant y los requerimientos estrictos sobre las direcciones de envío nulas o vacías.
