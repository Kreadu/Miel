---
id: S19-39
titulo: Traslado de stock entre bodegas (para cerrar o dar de baja una bodega)
estado: spec-ready
depende_de: [S19-38]
---

# S19-39 — Traslado entre bodegas

## Contexto
Pedido del humano (2026-09-30): al cerrar o dar de baja una bodega, su stock debe poder moverse a
otra en un solo paso, para que no quede "stock fantasma".

## Alcance (propuesta, a aprobar)
- RPC `transfer_stock(p_from, p_to, p_items [{product_id, qty}], p_note)`: owner/admin; misma
  empresa; salida en A y entrada en B al mismo costo, en una transacción; valida stock en A.
- Pantalla de bodegas: botón "Trasladar stock" por bodega (elegir destino, productos y
  cantidades; opción "trasladar todo").
- "Dar de baja" una bodega **con stock** pasa de aviso a **bloqueo**: "Traslada primero su stock".
- Kardex muestra "Traslado a/desde <bodega>". Textos es/en/fr. pgTAP + Vitest.
