---
id: S19-38
titulo: Bodegas — ver primero, "Editar" para cambiar, y "Dar de baja"
estado: implemented
depende_de: [S19-25, S18-10]
---

# S19-38 — Bodegas: ver, editar y dar de baja

## Contexto

Pedido del humano (2026-09-30): la bodega principal se muestra siempre como formulario abierto
con "Guardar cambios"; se puede tocar sin querer. Quiere verla primero en modo lectura, con
**"Editar"** que habilita los campos y luego **"Guardar"** / **"Cancelar"**, y un botón para
**dar de baja** una bodega (hoy en las otras dice "Eliminar", que en realidad la desactiva).

## Alcance (solo pantalla; sin BD)

- **Bodega principal:** se ve en modo lectura (datos, "Presta stock" sí/no). "Editar" → campos
  habilitados + "Guardar" y "Cancelar". Al guardar vuelve a modo lectura con "Guardado".
- **Otras bodegas:** mismo patrón (ya tenían "Editar"); "Eliminar" pasa a **"Dar de baja"**, en
  rojo y con confirmación. Las dadas de baja se ven tachadas con **"Reactivar"**.
- **La principal no se puede dar de baja** (regla de la BD): en su lugar un texto que lo explica.
- **Aprobado (con la nota de que falta el traslado, S19-39):** dar de baja una bodega **con stock** se permite, pero la
  confirmación avisa cuántas unidades tiene ("Tiene 25 unidades en stock; seguirán contando en
  el inventario hasta que las muevas"). Una bodega dada de baja no aparece para vender ni
  completar ventas.
- Textos es/en/fr.

## Criterios

- Nada se puede cambiar sin apretar "Editar"; "Cancelar" descarta los cambios.
- "Dar de baja" pide confirmación (con el stock si tiene) y la bodega queda tachada con
  "Reactivar"; la principal no ofrece el botón.
- Lint, tsc, `npm test`; navegador del humano.

## Notas de implementación

- `principal-form.tsx`: modo lectura (fieldset deshabilitado) → "Editar" → "Guardar"/"Cancelar"
  (Cancelar vuelve a montar los campos). Texto "La bodega principal no se puede dar de baja".
- `warehouse-row.tsx`: "Dar de baja" en rojo con confirmación; si tiene stock avisa las unidades
  (`current_stock` sumado por bodega en la página). Claves `warehouses.retire*`; borradas
  `delete`, `deleted`, `deleteConfirm`, `saveChanges`.
- La página de bodegas filtra por la empresa activa.
