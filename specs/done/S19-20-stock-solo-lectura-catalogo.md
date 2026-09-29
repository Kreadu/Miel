---
id: S19-20
titulo: Stock del producto en el catálogo solo desde las bodegas o sucursales (solo lectura)
estado: implemented
depende_de: [S19-14, S19-17]
---

# S19-20 — Stock solo lectura en el formulario del catálogo

## Contexto y valor

Pedido del humano 2026-09-29: la cantidad de stock debe venir directamente de las bodegas o
sucursales; en el producto solo se ve, no se modifica. Supersede el alcance de S19-14 (cargar
stock desde el alta/edición del catálogo). Aprobación: pedido explícito, misma sesión.

## Alcance

- Se quita el bloque "Stock" (bodega + cantidad) de `CatalogProductFields` y
  `registerStockIfPresent` de `src/actions/catalog.ts`; se deja de pasar `warehouses` por la
  cadena del catálogo.
- Al editar se ve "Stock total: N (Bodega A: x · Sucursal B: y)", sin inputs.
- El stock se sigue moviendo por `/inventario` (movimientos), compras, ventas y producción.

## NO-alcance / supuesto

- `/inventario/productos` conserva su "Stock inicial" del alta (S13-01): el pedido habla del
  formulario del catálogo. Se pregunta al humano si también quitarlo.

## Criterios de aceptación

1. **Dado** "Generar producto" o "Editar" en el catálogo **entonces** no hay campos de stock.
2. **Dado** la edición **entonces** se ve el total y el desglose por bodega o sucursal.
