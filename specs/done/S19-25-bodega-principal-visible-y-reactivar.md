---
id: S19-25
titulo: Bodega principal siempre visible con sus datos + Eliminar/Reactivar bodegas y productos
estado: implemented
depende_de: [S19-18, S19-24]
---

# S19-25 — Bodega principal visible, eliminar y reactivar

## Contexto y valor

Pedido del humano 2026-09-29: en Bodegas o sucursales deben verse todos los datos de la
principal en un formulario ya relleno; abajo, un botón para crear una bodega o sucursal nueva
(formulario vacío); cada una con Editar y Eliminar. Además: poder reactivar los productos
eliminados. Aprobación: pedido explícito, misma sesión.

## Alcance

- `/inventario/bodegas`: bloque "Bodega o sucursal principal" con el formulario relleno
  (editable owner/admin, solo lectura member) → "+ Crear bodega o sucursal" (abre formulario
  vacío, se cierra al crear) → "Otras bodegas o sucursales" con Editar y Eliminar (con
  confirmación). Eliminar = borrado lógico (`active=false`; el kardex referencia la bodega);
  las eliminadas se ven tachadas con "Reactivar". La principal no se elimina.
- `/inventario/productos`: sección "Productos eliminados" (owner/admin) con "Reactivar". Eliminar
  un producto pide confirmación.
- Sin cambios de esquema.

## Criterios de aceptación

1. La principal se ve con todos sus datos y se guarda desde ahí.
2. Crear bodega o sucursal usa un formulario vacío aparte.
3. Editar/Eliminar/Reactivar en las demás.
4. Un producto eliminado aparece en "Productos eliminados" y se puede reactivar.
