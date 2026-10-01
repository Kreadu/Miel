---
id: S18-11
titulo: Historial de pedidos en Pedidos, con botón y rango de fechas
estado: implemented
depende_de: [S18-06]
---

# S18-11 — Historial de pedidos

Pedido del humano (2026-09-30): no encontraba el historial de pedidos. En Pedidos, botón
**"Historial"** (como en Compras): desde–hasta (por defecto el mes en curso, hora de Bogotá) y
estado (todos / por completar / entregados / anulados). Tabla: fecha, boleta, cliente, estado,
comprobante, total, cobrado. Pie: total vendido y cobrado del rango (sin anuladas). Un clic en el
cliente abre su ficha. Textos es/en/fr. Test de los totales (función pura).


Implementado: `pedidos/sales-history.tsx` (servidor, GET), `lib/sales/history.ts` (+test). Usa `sales.document_type` (migración de S18-06): antes de aplicarla el historial sale vacío.
