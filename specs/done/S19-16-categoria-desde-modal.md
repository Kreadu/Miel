---
id: S19-16
titulo: Crear categoría con un "+" junto al selector (modal), sin botón suelto
estado: implemented
depende_de: [S19-15]
---

# S19-16 — Crear categoría desde un modal junto al selector

## Contexto y valor

Pedido del humano 2026-09-29 sobre S19-15: el botón suelto "Generar categoría" y el campo
"o creá una categoría nueva" sobran. En el formulario de producto, al lado del selector de
Categoría, solo un "+" que abre un modal, crea la categoría ahí mismo y la deja seleccionada,
sin perder lo ya escrito en el formulario.

Aprobación: el humano pidió explícitamente la historia; spec + implementación en la misma sesión
(mismo criterio que S19-02..S19-15).

## Alcance

- Se borra `CatalogCategoryForm` (botón "Generar categoría") de `/ventas/catalogo`.
- Se borra el campo `new_category_name` (UI, Zod, action) y `getOrCreateCategoryId`
  (`src/lib/categories/generic.ts`) — quedan sin uso.
- `CatalogProductFields`: botón "+" al lado del selector → modal (`Dialog`) con un input de
  nombre y "Crear". Al crear: la categoría se agrega a la lista del selector y queda
  seleccionada; el modal se cierra; el resto del formulario no se toca (inputs sin controlar,
  siguen montados).
- `createCategory(name)` pasa a devolver `{ ok: true, category: { id, name } }` para poder
  seleccionarla. Nombre duplicado → "Ya existe una categoría con ese nombre."
- El modal no usa un `<form>` propio (evita un form anidado dentro del form del producto): el
  botón "Crear" y Enter llaman a la action directamente.

## NO-alcance

- Sin editar/borrar categorías. Sin cambios de esquema.

## Criterios de aceptación

1. **Dado** `/ventas/catalogo` **entonces** no existe el botón "Generar categoría".
2. **Dado** el alta o edición de un producto con datos ya escritos **cuando** se aprieta "+",
   se escribe un nombre y se crea **entonces** la categoría queda seleccionada y los datos
   escritos siguen ahí.
3. **Dado** un nombre repetido **entonces** el modal muestra "Ya existe una categoría con ese
   nombre." y no se cierra.

## Tests

- Vitest `src/actions/catalog.test.ts`: `createCategory` devuelve la categoría creada; 23505 →
  mensaje de duplicado; nombre vacío → error de validación sin llamar a la BD.
- Vitest `catalog.test.ts`: se quita el caso de `new_category_name`.
