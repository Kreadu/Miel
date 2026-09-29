---
id: S19-13
titulo: Mostrar stock por bodega/sucursal en el Catálogo
estado: implemented
depende_de: [S19-02, S2-01, S2-03]
---

# S19-13 — Mostrar stock por bodega/sucursal en el Catálogo

## Contexto y valor

El dueño pidió ver, dentro de cada producto del catálogo, en qué bodega/tienda/sucursal está y el
stock total en todas.

**Verificado antes de implementar:** no hace falta esquema nuevo — `current_stock` (vista de
`stock_movements`, S2-03/kardex) ya agrupa cantidad por `product_id` + `warehouse_id` y por
tenant. Solo faltaba consultarla desde el catálogo y mostrarla.

## Alcance

- `catalogo/page.tsx` trae `current_stock` (`product_id, warehouse_id, total_qty`) y `warehouses`
  (`id, name`) del tenant activo, arma un mapa `productId → [{warehouseName, qty}]`.
- `CatalogCard` muestra, debajo del precio: el stock total sumado, y el detalle por bodega
  ("Bodega A: 5 · Sucursal Centro: 7"). Sin stock registrado (ningún movimiento todavía, caso
  esperable para un producto recién generado desde el catálogo, que no pasa por el flujo de
  stock inicial de S13-01) muestra "Sin stock registrado" en vez de un vacío confuso.

## NO-alcance (explícito)

- ~~No se agrega gestión de stock desde el catálogo~~ **Superado por S19-14, mismo día**: el
  humano aclaró que necesitaba poder cargar stock, no solo verlo — S19-14 agrega el bloque
  "Stock" (bodega + cantidad) al alta/edición del catálogo, reusando `register_movement`.
- No se filtra el catálogo por disponibilidad de stock — un producto sin stock sigue apareciendo
  (mostrar/gestionar catálogo es independiente de si hay inventario físico, sobre todo para
  productos de canal "online" que podrían despacharse bajo pedido).

## Criterios de aceptación

1. **Dado** un producto con stock en 2 bodegas **cuando** se mira su tarjeta en el catálogo
   **entonces** se ve el total y el desglose por bodega.
2. **Dado** un producto sin ningún movimiento de stock **cuando** se mira su tarjeta **entonces**
   dice "Sin stock registrado", no un espacio vacío.

## Plan de tests

| Criterio | Tipo | Qué verifica |
|---|---|---|
| 1, 2 | manual (sin Playwright en este sandbox) | verificado a mano por el humano |

## Historial

- 2026-09-28 · pedido por el humano ("Dentro de producto se debe agregar, en que bodega tienda o
  sucursal está y el stock o inventario que hay en todas las sucursales... de ese producto").
