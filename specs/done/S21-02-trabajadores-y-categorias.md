---
id: S21-02
titulo: RRHH — Trabajadores y categorías de trabajador
estado: implemented
depende_de: [S21-01]
---

# S21-02 — Trabajadores y categorías

## Contexto y valor

Pedido del humano 2026-09-29: en RRHH, registrar a los **trabajadores** (no "empleados") con sus
datos, y una **categoría de trabajador** que define qué partes de Miel ve. Decisiones del humano:
las categorías las crea el dueño marcando módulos; el ingreso del trabajador será con usuario +
código de 4 dígitos (S21-03) y habrá control de uso (S21-04).

## Alcance

- Migración `20260929194004_trabajadores-y-categorias.sql`: `worker_categories` (nombre +
  `modules` ⊂ {ventas, inventario, compras, gastos, rrhh}) y `workers` (identificación, trabajo,
  seguridad social, contacto, bodega o sucursal, categoría, `active`). RLS: solo owner/admin
  (salarios y datos personales). Documento único por empresa; trigger que exige categoría y
  bodega de la misma empresa.
- `/equipo/categorias`: crear, editar (módulos con casillas), eliminar (sus trabajadores quedan
  sin categoría). `/equipo/trabajadores`: agregar, editar, retirar/reactivar (borrado lógico).
  Accesos desde RRHH.

## Ajuste 2026-09-29 (S21-02b, pedido del humano)

- "+" junto a Categoría en la ficha del trabajador (`WorkerCategoryPicker` +
  `quickCreateWorkerCategory`): crea la categoría con sus módulos y la deja elegida.
- "Borrar trabajador" al editar (con confirmación): migración
  `20260929195038_borrar-trabajador.sql` (política delete solo owner/admin), `deleteWorker`.
  "Retirar" (borrado lógico) sigue en la lista. pgTAP `S21-02b-borrar-trabajador.sql`.

## Ajuste 2026-09-29 (S21-02c, pedido del humano)

- **Cargos** como lista propia: `worker_positions` (RLS owner/admin) y `workers.position_id`; los
  cargos escritos a mano se pasaron a la lista y se quitó la columna de texto. Pantalla
  `/equipo/cargos` (crear, editar, borrar) y "+" junto a Cargo en la ficha (`PositionPicker`).
- **Contacto de urgencia**: `emergency_contact_name`, `emergency_phone`.
- **Temporales y por horas**: `workers.worker_type` (planta/temporal/por_horas), `end_date`
  (temporal), `hourly_rate` (por horas, en lugar del salario mensual). Área aparte
  `/equipo/temporales`; `/equipo/trabajadores` muestra solo planta (`WorkersView`).
- Migración `20260929195544_cargos-urgencia-temporales.sql`; pgTAP `S21-02c-cargos.sql`.

## NO-alcance (siguientes historias)

- Usuario y código de 4 dígitos, restricción real de módulos al entrar (S21-03).
- Registro de ingresos y acciones (S21-04). Nómina (S21-05).

## Tests

- pgTAP `supabase/tests/S21-02-trabajadores.sql`. Vitest `src/lib/validation/workers.test.ts`,
  `src/actions/workers.test.ts`.
