---
id: S19-40
titulo: Un producto agotado siempre avisa, y aviso llamativo en la app
estado: implemented
depende_de: [S19-27]
---

# S19-40 — Alerta de agotados

## Contexto
Pedido del humano (2026-09-30): gastó todo un producto y no hubo aviso para generar la orden de
compra. Causa: `low_stock_alerts` solo incluía productos con `min_stock > 0`.

## Alcance
- `low_stock_alerts` incluye también los productos **agotados** (stock ≤ 0) que alguna vez tuvieron
  movimientos, aunque su mínimo sea 0; columna nueva `out_of_stock` al final de la vista.
- **Aviso rojo** arriba del contenido en todas las pantallas, para dueño/admin y quien tenga el
  módulo Comprar: "N productos agotados o bajo el mínimo — Ver y pedir" → Inventario → Alertas.
- En Alertas, los agotados se marcan "Agotado". Textos es/en/fr.

## Criterios
- Producto con mínimo 0 que llega a 0: aparece en alertas y en el aviso.
- Producto nunca ingresado (sin movimientos) con mínimo 0: no aparece (p. ej. servicios).
- Sin productos en alerta: no hay aviso.
- pgTAP de la vista; lint, tsc, `npm test`.

## Notas de implementación
- Migración `20260930250000_alerta-de-agotados.sql` (vista con `out_of_stock` al final); pgTAP 4
  pruebas, sin correr aquí. Aviso en `(app)/layout.tsx` (conteo con `head: true`), plural ICU.
- Antes de aplicar la migración, la página de Alertas no muestra nada (pide `out_of_stock`).
