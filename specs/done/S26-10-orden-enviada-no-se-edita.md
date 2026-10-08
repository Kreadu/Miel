---
id: S26-10
titulo: Una orden aprobada y enviada no se edita
estado: implemented
depende_de: [S26-09, S28-01]
---

# S26-10 — Una orden aprobada y enviada no se edita

## Decisión del humano (2026-10-08)
- **Antes de aprobarla:** solo la editan el dueño o un aprobador asignado. Al editarla, queda
  aprobada por él.
- **Una vez aprobada y enviada:** nadie la edita. Las diferencias de cantidad o precio se
  registran al recibirla, con la factura del proveedor (S28-01/02).
- **Cancelar** sigue disponible para el dueño o un administrador mientras no haya nada recibido.

## Criterios
1. `update_purchase` exige `user_can_approve_purchases` y `status = 'draft'`. Si no se cumple
   devuelve `permission_denied` o `purchase_not_updatable`.
2. La UI muestra "Editar" solo en borradores y solo a un aprobador.

## Tests
- pgTAP: S26-09 (enviada no se edita; quien no aprueba no edita).
- Se adaptó S26-02.
- Solo en PGlite.

## Historial
- 2026-10-08 · pedido y aprobado por el humano; implemented. Reemplaza el punto 4 de S26-09
  (editar una orden enviada).
