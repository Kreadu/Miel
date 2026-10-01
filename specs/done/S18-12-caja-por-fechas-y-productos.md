---
id: S18-12
titulo: Caja — lo de hoy por defecto, rango de fechas, y qué productos se vendieron
estado: implemented
depende_de: [S18-08]
---

# S18-12 — Caja por fechas y productos vendidos

Pedido del humano (2026-09-30, aprobado): en Caja ver solo lo del día; para otros días, un rango
de fechas; y una línea con qué producto y cuántos se vendieron.

## Implementado
- Movimientos (cobros y devoluciones) del **día** por defecto; formulario desde–hasta y "Volver a
  hoy" (`lib/cash/range.ts` + test). El resumen de turnos usa el mismo rango.
- Cada cobro muestra debajo del cliente los productos y cantidades de su venta ("3 × Miel").
- Un operativo ve solo sus cobros; dueño/admin ven todos con "Quién cobró" (nombre de "Mi
  perfil", S26-01; si no lo puso, "Otro usuario").
- Totales por forma de pago del rango. Sin migración propia.
