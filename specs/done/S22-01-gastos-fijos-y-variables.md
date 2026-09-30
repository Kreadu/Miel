---
id: S22-01
titulo: Gastos en dos hojas (fijos y variables) con categorías ya clasificadas
estado: implemented
depende_de: [S7-01, S21-06]
---

# S22-01 — Gastos fijos y variables

## Contexto y valor

Pedido del humano 2026-09-29: dos botones arriba (Gastos fijos, Gastos variables); categorías ya
asignadas como fijas o variables (incluidas las de los inventarios: artículos de oficina, aseo,
etc.) para que quien anota no tenga que decidir; mano de obra clasificada en fija/variable;
tabla que se va llenando debajo con Editar y Borrar; muy sencillo y fiable porque alimenta el
estado de resultados que se creará.

## Alcance

- Migración `20260929212405_categorias-de-gasto.sql`: `expense_categories` (nombre + tipo, RLS owner/admin), lista inicial
  sembrada en todas las empresas y en cada empresa nueva (trigger en `tenants`), y trigger en
  `expenses` que **impone el tipo según la categoría** (una categoría fuera de la lista —gastos
  viejos escritos a mano— conserva el tipo elegido).
- Validación y acciones reescritas: categoría obligatoria, fecha como día (mediodía de Bogotá),
  columnas explícitas, `quickCreateExpenseCategory` ("+" con el tipo de la hoja).
- `/gastos?tipo=fijos|variables`: dos botones, totales del mes (anotados + mano de obra desde
  RRHH + total), formulario, tabla con Editar (en el lugar) y Borrar.
- La mano de obra se clasifica en la ficha del trabajador (S21-04) y entra por `monthly_payroll`
  (S21-06).

## NO-alcance

- Estado de resultados (siguiente historia). Crear gastos automáticamente al recibir compras de
  inventarios de oficina/aseo (evitaría doble registro; a decidir).

## Tests

- pgTAP `supabase/tests/S22-01-categorias-de-gasto.sql`. Vitest
  `src/lib/validation/expenses.test.ts`, `src/actions/expenses.test.ts`.
