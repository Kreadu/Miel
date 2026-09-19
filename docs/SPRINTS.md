---
topic: plan-de-sprints
status: vigente
related: [BACKLOG.md, GOVERNANCE.md]
---

# SPRINTS — Plan del MVP

Un sprint es una agrupación temática, no un plazo fijo: se avanza historia por historia
(una por sesión) respetando el grafo de dependencias del BACKLOG. No se inicia una historia
si sus dependencias no están `done`.

| Sprint | Objetivo | Historias | Criterio de cierre |
|---|---|---|---|
| 0 | Arnés: gobernanza SDD+TDD, wiki, backlog, scaffolding, CI | — | Repo con CI verde y specs listas para redactar |
| 1 | Fundación multitenant: auth, tenants, roles, layout | S1-01…S1-05 | Un usuario crea empresa, invita a otro, y RLS aísla tenants (probado) |
| 2 | Inventario completo (con kardex valorizado) | S2-01…S2-05 | Stock consistente vía RPC, kardex a promedio ponderado, alertas de mínimo |
| 3 | Compras a proveedores | S3-01…S3-04 | Recibir compra afecta stock atómicamente |
| 4 | Pagos a proveedores y cuentas por pagar | S4-01…S4-02 | Saldos por proveedor correctos e invariante de pago probado |
| 5 | Clientes, ventas y POS (CRM completo) | S5-01…S5-10 | Vender descuenta stock con costo congelado; despacho trazable; CxC, historial e interacciones correctos; venta de mostrador en un paso con caja abierta y arqueo correcto |
| 6 | Producción (recetas opcionales) | S6-01…S6-02 | Producir consume insumos y entra terminado costeado, atómico y probado |
| 7 | Gastos y finanzas | S7-01…S7-03 | P&L, flujo de caja y rentabilidad correctos; página Finanzas con gráficas de gastos fijos/variables y detección de fugas |
| 8 | Dashboard gerencial | S8-01…S8-02 | Gerente ve métricas clave en una pantalla |
| 9 | Hardening y beta | S9-01…S9-03 | Deploy productivo con e2e verde y datos demo |

## Orden crítico de dependencias
`S1-01` bloquea todo. `S2-03` (RPC de movimientos) es el cuello de botella: bloquea recepción
de compras (`S3-03`), confirmación de ventas (`S5-03`) y producción (`S6-02`). `S5-03` bloquea
pagos de clientes, despacho (`S5-06`), el POS (`S5-08`…`S5-10`), finanzas (`S7-02`) y el e2e
(`S9-01`, que llega hasta despacho). El dashboard (E8) necesita inventario, CxP y finanzas. Los CRUD de arranque (`S3-01`, `S5-01`, `S7-01`) solo dependen de `S1-04` y pueden
adelantarse en paralelo si hay sesiones disponibles.

## Ritmo recomendado por sesión
1 sesión = redactar spec de la siguiente historia (queda `spec-ready` para aprobación) **o**
implementar una spec ya `approved`. Evitar sesiones mixtas salvo historias muy pequeñas.
