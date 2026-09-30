---
id: S20-05
titulo: Idiomas (es/en/fr) — módulo 5 de 7: Gastos
estado: implemented
depende_de: [S20-04]
---

# S20-05 — Idiomas: Gastos

## Contexto

Quinto módulo de E20 (ADR-040). Mismo patrón que S20-01..04: acciones y Zod devuelven claves, el
componente traduce; figuras colombianas con su sigla.

## Alcance

Pantallas de `src/app/(app)/gastos/`: página, nuevo gasto, formulario, fila y selector de
categoría. Acción `actions/expenses.ts` y `lib/validation/expenses.ts` → devuelven claves
(`expenses.errors.*`).

**Categorías que trae Miel** (las 25 que crea `seed_expense_categories`, p. ej. "Arriendo",
"Combustible"): se guardan en la BD con su nombre en español. Se traducen **al mostrarlas**: si la
categoría es de las que trae Miel (`is_default`) y su nombre coincide con uno conocido, se muestra
traducido; si el dueño la renombró o creó una propia, se muestra tal cual la escribió.
(Ajuste al implementar: el gasto guarda la categoría como texto, no su id, así que se reconoce
por el nombre exacto, sin mirar `is_default`.) Sin
migración ni cambio de datos. El mismo traductor se reutiliza en Resultados (S20-06).

Fuera de alcance: Finanzas/Resultados (S20-06). Formato de dinero y fechas sigue colombiano.

## Criterios

- Ninguna pantalla del alcance muestra texto en español fijo cuando el idioma es en/fr.
- Las acciones devuelven claves; los tests de acciones/validación comparan claves.
- Categorías de Miel traducidas; las creadas o renombradas por el dueño, tal cual.
- Test del traductor de categorías: nombre conocido → clave; nombre propio → sin traducir.
- `src/i18n/messages.test.ts` en verde. Verificación: lint, tsc, `npm test`; navegador del humano.

## Notas de implementación

- `src/lib/expenses/category-label.ts`: `defaultCategoryKey(nombre)` y `categoryLabel(nombre, t)`
  (25 categorías de Miel → `expenses.categories.*`); test en `category-label.test.ts`.
- El `<select>` sigue enviando el nombre en español (es el dato guardado); solo cambia la etiqueta.
- Claves nuevas `expenses.*`; métodos de pago reutilizan `sales.paymentMethod`. Quitado
  `METHOD_LABEL` (huérfano) y `title` de las hojas.
