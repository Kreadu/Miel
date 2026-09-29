---
id: S19-14
titulo: Agregar stock y elegir bodega/sucursal/tienda desde el formulario del catálogo
estado: implemented
depende_de: [S19-02, S19-13, S2-01, S2-03]
---

# S19-14 — Agregar stock y elegir bodega/sucursal/tienda desde el formulario del catálogo

## Contexto y valor

S19-13 mostraba el stock (solo lectura). El dueño aclaró que necesita **cargar** stock y elegir en
qué bodega/sucursal/tienda está un producto directamente desde el alta/edición del catálogo, no
solo verlo.

**Reuso, no invención:** `register_movement` (RPC de S2-03, ya usada por
`create_product_with_stock` en el alta de inventario, S13-01) ya registra una entrada de stock
atómica para un producto+bodega. El formulario del catálogo llama a la misma RPC.

## Alcance

- `CatalogProductFields` gana un bloque opcional "Stock" (bodega + cantidad), mismo patrón visual
  que el bloque "Stock inicial" de `ProductForm` (S13-01) — recibe la lista de bodegas activas
  del tenant.
- `catalogo/page.tsx` pasa `warehouses` (activas) a `CatalogProductForm` (alta) y a cada
  `CatalogCard` (edición).
- `createCatalogProduct`: si se eligió bodega+cantidad, tras insertar el producto llama a
  `register_movement` (`kind: 'in'`, `unit_cost: 0` — el catálogo no pide costo, S19-02) para esa
  bodega. Si el movimiento falla, el producto igual queda creado (falla "suave": se informa el
  error de stock sin perder el alta del producto).
- `updateCatalogProduct`: mismo mecanismo — permite **agregar** más stock a una bodega al editar
  (se suma a lo que ya había, mismo modelo que cualquier movimiento `'in'`; no reemplaza el stock
  existente).

## NO-alcance (explícito)

- No permite registrar salidas (`'out'`) ni ajustes desde el catálogo — solo entradas, que es lo
  pedido ("agregar stock"). Correcciones/salidas siguen siendo el flujo de
  `/inventario/bodegas`/kardex.
- No pide costo unitario (el catálogo nunca lo pidió, S19-02) — la entrada queda con
  `unit_cost: 0`, igual que el resto de la ficha simplificada.
- No permite elegir varias bodegas a la vez en una sola alta — una bodega por operación, se puede
  repetir editando de nuevo para sumar stock en otra.

## Criterios de aceptación

1. **Dado** un owner/admin **cuando** genera un producto y elige bodega + cantidad **entonces**
   el producto se crea y su stock en esa bodega refleja la cantidad ingresada.
2. **Dado** un producto existente **cuando** se edita y se elige bodega + cantidad **entonces** se
   suma esa cantidad al stock de esa bodega (no lo reemplaza).
3. **Dado** un alta/edición sin bodega elegida **cuando** se guarda **entonces** el producto se
   guarda igual, sin tocar stock (campo opcional).

## Plan de tests

| Criterio | Tipo | Qué verifica |
|---|---|---|
| 1–3 | manual (sin Playwright en este sandbox) | verificado a mano por el humano |

## Historial

- 2026-09-28 · el humano aclaró que S19-13 (solo lectura) no alcanzaba: "no puedo agregar ni el
  estoc y ni las bodegas, sucursales o tiendas donde están" — necesitaba poder cargarlo, no solo
  verlo.
