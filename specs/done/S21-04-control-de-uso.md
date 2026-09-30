---
id: S21-04
titulo: Control de uso (ingresos y acciones importantes) + clasificación de costo del trabajador
estado: implemented
depende_de: [S21-03]
---

# S21-04 — Control de uso

## Contexto y valor

Pedido del humano 2026-09-29: saber el uso y tener el control (quién entró y qué hizo), y en la
ficha del trabajador un desplegable para saber si, por su cargo o trabajo, su pago es gasto o
costo, fijo o variable.

## Alcance

- Migración `20260929205403_control-de-uso.sql`: `activity_log` (acción, trabajador del modo
  tienda, detalle; insert solo del propio actor, lectura owner/admin, sin editar ni borrar;
  trigger de trabajador de la misma empresa) y `workers.cost_classification`
  (gasto_fijo/gasto_variable/costo_fijo/costo_variable).
- `logActivity` (`src/lib/activity/log.ts`, nunca rompe la operación) en: pedido creado, boleta
  generada, cobro registrado, caja abierta/cerrada, compra recibida, stock ajustado (movimiento
  manual o edición del stock por bodega, solo si cambió algo).
- `/equipo/uso`: ingresos con código (incluye códigos incorrectos) y acciones, con filtro de
  fechas y trabajador. Acceso desde RRHH.
- Ficha del trabajador: "Su pago es (para finanzas)".

## NO-alcance

- Usar la clasificación en Finanzas (P&L) — queda guardada para eso.

## Tests

- pgTAP `supabase/tests/S21-04-control-de-uso.sql`. Vitest `src/lib/activity/log.test.ts`,
  `src/lib/validation/workers.test.ts`.
