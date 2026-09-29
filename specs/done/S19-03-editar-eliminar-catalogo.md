---
id: S19-03
titulo: Editar y eliminar producto desde el Catálogo
estado: implemented
depende_de: [S19-02]
---

# S19-03 — Editar y eliminar producto desde el Catálogo

## Contexto y valor

El dueño pidió poder editar y eliminar un producto directamente desde `/ventas/catalogo`, sin
tener que ir a `/inventario/productos`.

## Alcance

- Cada tarjeta del catálogo gana, si `canManage` (`role !== "member"`, mismo criterio que el resto
  de la gestión de productos), dos botones: **Editar** y **Eliminar**.
- **Editar**: despliega inline el mismo formulario de alta (nombre, descripción, precio,
  descuento, foto opcional — reemplaza la foto solo si se sube una nueva), precargado con los
  valores actuales. Nueva Server Action `updateCatalogProduct`.
- **Eliminar**: reusa `toggleProductActive` (ya existe, `src/actions/products.ts`) con
  `active=false` — el soft-delete que ya usa `/inventario/productos`, nunca un `DELETE` físico
  (regla de AGENTS.md). Se le agrega `revalidatePath("/ventas/catalogo")` (antes solo
  revalidaba `/inventario/productos`) para que el catálogo refleje el borrado sin recargar.
- Un producto "eliminado" desaparece de `/ventas/catalogo` (que ya filtra `active=true`) pero
  sigue existiendo, editable/reactivable, en `/inventario/productos` — mismo dato, misma fila.

## Supuesto sin confirmar (ambigüedad de spec)

"Eliminar" se implementa como el soft-delete ya existente (`active=false`), no un `DELETE` físico
— consistente con la regla del proyecto y con que `/inventario/productos` ya usa "Archivar" para
lo mismo. Se etiqueta "Eliminar" en el catálogo (palabra del dueño) aunque técnicamente archive.

## Criterios de aceptación

1. **Dado** un owner/admin **cuando** entra a `/ventas/catalogo` **entonces** cada tarjeta tiene
   botones "Editar" y "Eliminar"; un `member` no los ve.
2. **Dado** un owner/admin **cuando** edita nombre/precio/descuento sin tocar la foto **entonces**
   se guarda y la foto anterior no cambia.
3. **Dado** un owner/admin **cuando** edita y sube una foto nueva **entonces** la tarjeta muestra
   la foto nueva.
4. **Dado** un owner/admin **cuando** aprieta "Eliminar" **entonces** el producto desaparece del
   catálogo pero sigue visible (archivado) en `/inventario/productos`.

## Plan de tests

| Criterio | Tipo | Qué verifica |
|---|---|---|
| 1–4 | manual (sin Playwright en este sandbox) | verificado a mano por el humano vía `npm run dev` |

## Historial

- 2026-09-28 · aprobada por el humano en la misma sesión ("hay que agregar el botón de editar
  producto y eliminar producto").
