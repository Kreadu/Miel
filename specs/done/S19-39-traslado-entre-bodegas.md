---
id: S19-39
titulo: Traslado de stock entre bodegas (para cerrar o dar de baja una bodega)
estado: implemented
depende_de: [S19-38]
---

# S19-39 — Traslado entre bodegas

## Contexto
Pedido del humano (2026-09-30): al cerrar o dar de baja una bodega, su stock debe poder moverse a
otra en un solo paso, para que no quede "stock fantasma".

## Alcance (aprobado)
- RPC `transfer_stock(p_from, p_to, p_items [{product_id, qty}], p_note)`: owner/admin; misma
  empresa; salida en A y entrada en B al mismo costo, en una transacción; valida stock en A.
- Pantalla de bodegas: botón "Trasladar stock" por bodega (elegir destino, productos y
  cantidades; opción "trasladar todo").
- "Dar de baja" una bodega **con stock** pasa de aviso a **bloqueo**: "Traslada primero su stock".
- Kardex muestra "Traslado a/desde <bodega>". Textos es/en/fr. pgTAP + Vitest.

## Notas de implementación

- Migración `20260930240000_traslado-entre-bodegas.sql`: RPC `transfer_stock` (salida + entrada
  con `ref_type = 'transfer'` y el mismo `ref_id`, entrada al costo de la salida) y trigger
  `warehouses_block_retire_with_stock` (`warehouse_has_stock`). pgTAP 12 pruebas, sin correr aquí.
- Bodegas: "Trasladar stock" en la principal y en las demás (destino, cantidades, "Trasladar
  todo", nota). Con stock no aparece "Dar de baja": dice "Tiene N unidades: trasládalas…".
- Kardex: tipo de referencia traducido (Venta, Devolución, Traslado…) y sin mostrar ids internos.
- Nota: se formateó con prettier `principal-form.tsx`, `warehouse-row.tsx` y la página de bodegas
  (el repo no tiene prettier configurado; solo cambia el formato).
