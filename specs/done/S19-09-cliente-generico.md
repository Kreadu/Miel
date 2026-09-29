---
id: S19-09
titulo: Cliente genérico cuando no se elige cliente en una venta
estado: implemented
depende_de: [S5-02]
---

# S19-09 — Cliente genérico cuando no se elige cliente en una venta

## Contexto y valor

Hoy "Mostrador / sin cliente" (Pedidos/POS) crea la venta con `customer_id = null`. El dueño pidió
dejar un cliente genérico real en vez de nulo — solo se usa cuando explícitamente no se quiere
elegir un cliente puntual.

**Efecto colateral útil, verificado antes de implementar:** `SaleRow` solo ofrece "Registrar
cobro" (`isReceivable`) cuando `sale.customerId !== null`. Con `customer_id` siempre nulo en
ventas de mostrador, esas ventas nunca podían recibir un cobro registrado. Con un cliente genérico
real, esa limitación desaparece sin tocar `SaleRow`.

## Alcance

- `customers` gana `is_generic boolean not null default false`, con un índice único parcial
  (`(tenant_id) where is_generic`) — como máximo un cliente genérico por tenant.
- `getOrCreateGenericCustomerId(supabase, tenantId)` (`src/lib/customers/generic.ts`, compartido):
  busca el cliente genérico del tenant; si no existe, lo crea (`name: "Cliente genérico"`).
  Maneja la carrera de dos ventas concurrentes creándolo a la vez (23505 del índice único → relee
  en vez de fallar).
- `createSale` (`/ventas/pedidos`, usado por `SaleForm` y `CatalogPedidoCart`) y `registerPosSale`
  (`/ventas/pos`): cuando el formulario no trae `customer_id` (sentinel "Mostrador/sin cliente"),
  resuelven al cliente genérico en vez de enviar `null`.

## NO-alcance (explícito)

- No se cambian las etiquetas de la UI ("Mostrador / sin cliente" sigue diciendo eso) — el cambio
  es de qué id se termina guardando, no de cómo se ve el selector.
- El cliente genérico es un `customer` normal (editable, archivable) — no tiene protección especial
  contra edición/archivado. Si se archiva sin querer, `getOrCreateGenericCustomerId` no filtra por
  `active`, así que lo sigue reusando igual (evita crear uno nuevo por error).

## Criterios de aceptación

1. **Dado** un tenant sin cliente genérico todavía **cuando** se confirma una venta sin elegir
   cliente **entonces** se crea un cliente "Cliente genérico" y la venta queda asociada a él.
2. **Dado** un tenant que ya tiene su cliente genérico **cuando** se confirma otra venta sin
   cliente **entonces** reusa el mismo cliente (no crea uno nuevo cada vez).
3. **Dado** una venta con el cliente genérico, confirmada **cuando** se mira en `/ventas/pedidos`
   **entonces** aparece "Registrar cobro" (antes no aparecía con `customer_id = null`).

## Modelo de datos y migraciones

```sql
alter table public.customers
  add column if not exists is_generic boolean not null default false;

create unique index if not exists customers_one_generic_per_tenant
  on public.customers (tenant_id) where is_generic;
```

## Plan de tests

| Criterio | Tipo | Qué verifica |
|---|---|---|
| 1–3 | manual (sin Playwright en este sandbox) | verificado a mano por el humano |

## Historial

- 2026-09-28 · pedido por el humano ("Hay que dejar un cliente generico, solo si no se desea
  agregar cliente a la venta").
