---
id: S19-26
titulo: Tipos de inventario (productos, materias primas, oficina, mobiliario, vehículos, herramientas, aseo)
estado: implemented
depende_de: [S19-24]
---

# S19-26 — Tipos de inventario

## Contexto y valor

Pedido del humano 2026-09-29: al entrar a Inventario, un botón por cada inventario (primero
"Inventario de productos"), y dentro de cada uno crear, editar y eliminar. Materias primas
separadas. Vehículos y mobiliario con sus características (placa, marca, modelo, año, color,
serie, fecha de compra). Aprobación: pedido explícito + respuestas del humano, misma sesión.

## Alcance

- Migración `20260929165506_tipos-de-inventario.sql`: `products.inventory` (lista fija con
  check, default `productos`), `kind` admite `other`, columnas de activos (`plate`, `brand`,
  `model`, `vehicle_year`, `color`, `serial_number`, `purchase_date`), backfill de `kind='raw'`
  a `materias_primas`, `products_catalog` expone todo (al final del select).
- `src/lib/inventories.ts`: configuración de cada inventario (título, botón, si se vende,
  kind fijo, campos de activo). Solo "productos" se vende (Catálogo, Pedidos, receta).
- Mismo formulario y tarjeta para todos (`ProductFields` según inventario); `InventoryView`
  compartida por `/inventario/productos` y `/inventario/<tipo>`; categorías y "Eliminados"
  en cada uno. El servidor fija `kind` según el inventario y pone precio/descuento en 0 en lo
  que no se vende.
- `/inventario`: grilla de botones por inventario con cantidad de ítems.
- Receta: insumos solo `raw`/`resale`. Pedidos: solo inventario `productos`.

## NO-alcance

- Inventarios personalizados creados por el usuario (lista fija por ahora).
- Categorías compartidas entre inventarios (una sola lista por empresa).

## Criterios de aceptación

1. Un botón por inventario en `/inventario`, productos primero.
2. Crear/editar/eliminar/reactivar en cada inventario.
3. Vehículos piden placa, marca, modelo, año, color, serie, fecha de compra; mobiliario y
   herramientas marca, modelo, serie, fecha de compra.
4. Materias primas existentes quedan en su inventario; el Catálogo solo muestra productos.

## Tests

- pgTAP `supabase/tests/S19-26-tipos-de-inventario.sql`. Vitest `src/lib/inventories.test.ts`,
  `src/lib/validation/products.test.ts`, `src/actions/products.test.ts`.
