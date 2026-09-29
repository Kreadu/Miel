---
id: S19-21
titulo: Botón "Categorías" para crear, renombrar y eliminar, unido al "+" del producto
estado: implemented
depende_de: [S19-15, S19-16]
---

# S19-21 — Gestionar categorías

## Contexto y valor

Pedido del humano 2026-09-29: junto a "Generar producto", un botón que permita crear, editar y
eliminar categorías, y que sea lo mismo que el "+" de categoría dentro del producto.
Aprobación: pedido explícito, misma sesión.

## Alcance

- Migración `20260929151018_editar-eliminar-categorias.sql`: políticas RLS de update y delete
  (solo owner/admin, `user_is_tenant_admin`) + `grant update (name), delete`.
- Actions `renameCategory(id, name)` y `deleteCategory(id)` (Zod; 0 filas afectadas = error;
  23505 → "Ya existe una categoría con ese nombre.").
- `CategoryManager` (Dialog sin `<form>`): crear, renombrar (inline) y eliminar (con
  confirmación). Lo abren el botón "Categorías" del catálogo y el "+" del formulario de
  producto; desde el "+", la categoría creada queda elegida.
- Borrar una categoría deja sus productos sin categoría (`on delete set null`, S19-15). Si la
  categoría elegida en un formulario abierto se borra, el selector vuelve a "Sin categoría".

## Criterios de aceptación

1. Owner/admin crea, renombra y elimina desde el botón "Categorías" o desde el "+".
2. Member no puede renombrar ni eliminar (RLS).
3. Eliminar no borra productos; quedan sin categoría.
4. Aislamiento: no se tocan categorías de otra empresa.

## Tests

- pgTAP `supabase/tests/S19-21-gestionar-categorias.sql`.
- Vitest `src/actions/catalog.test.ts` (rename/delete).
