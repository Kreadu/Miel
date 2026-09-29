---
id: S19-19
titulo: Texto visible "Bodega" → "Bodega o sucursal"
estado: implemented
depende_de: [S2-01]
---

# S19-19 — "Bodega o sucursal" en todo texto visible

## Contexto y valor

Pedido del humano 2026-09-29: donde diga "Bodega" debe decir "Bodega o sucursal". Solo texto
visible — tablas, columnas y rutas (`/inventario/bodegas`, `warehouses`) no cambian.
Aprobación: pedido explícito; spec + implementación en la misma sesión.

## Alcance

- Labels, placeholders, títulos, estados vacíos y mensajes de error de Server Actions/Zod que
  llegan al usuario, en Inventario, Kardex, Productos, Compras, Producción, Pedidos, POS,
  Catálogo y la landing. Plural: "Bodegas o sucursales".
- Tests que comparan el texto exacto de esos mensajes se actualizan.

## NO-alcance

- Identificadores, rutas, nombres de tabla/columna, comentarios de código.

## Criterios de aceptación

1. **Dado** cualquier pantalla de la app **entonces** no aparece "Bodega" suelto como texto
   visible; aparece "Bodega o sucursal".
