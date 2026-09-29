---
id: S19-11
titulo: El Pedido refresca precio/descuento/IVA del carrito contra la BD al abrirse
estado: implemented
depende_de: [S19-06]
---

# S19-11 — El Pedido refresca precio/descuento/IVA del carrito contra la BD al abrirse

## Contexto y valor

El humano reportó que el IVA no se calculaba en el Pedido. Causa real: el carrito (S19-06) guarda
una **foto** de precio/descuento/IVA en `localStorage` al momento de "Agregar al pedido" — los
productos ya estaban en el carrito desde *antes* de que se corrigiera el default de IVA (S19-10),
así que seguían con el 0% viejo aunque la base de datos ya tuviera 19%. No era un bug de cálculo
(la fórmula ya estaba bien, S19-08) sino de datos desactualizados en el carrito.

## Alcance

- `useCatalogCart` gana `updateLineData(productId, {name, price, discountPercent, taxRate})` —
  reconcilia una línea sin tocar la cantidad que eligió el humano.
- Nueva Server Action `refreshCartProductData(productIds)` (`src/actions/catalog.ts`): trae
  precio/descuento/IVA actuales de `products_catalog` para los ids del carrito.
- `CatalogPedidoCart`: al abrirse (una sola vez por carga, `useRef` evita reejecutar cuando la
  propia actualización cambia `lines`), reconcilia todas las líneas contra la BD.

## NO-alcance (explícito)

- No reconcilia en cada render/cambio — solo una vez al entrar a la página. Si el precio cambia
  mientras el humano está parado en el Pedido, no se refresca en caliente (alcance razonable, sin
  pedirlo).
- No elimina líneas cuyo producto ya no exista/esté inactivo — sigue mostrando el último dato
  conocido (evita sorprender al humano borrándole algo del carrito sin avisar).

## Criterios de aceptación

1. **Dado** un carrito armado antes de que el IVA de un producto cambiara **cuando** se entra a
   `/ventas/pedidos` **entonces** la línea se actualiza con el IVA/precio/descuento actuales, sin
   perder la cantidad elegida.
2. **Dado** un pedido ya reconciliado **cuando** el humano cambia una cantidad **entonces** no se
   vuelve a pisar el precio/IVA con otra llamada al servidor (solo pasó una vez al entrar).

## Plan de tests

| Criterio | Tipo | Qué verifica |
|---|---|---|
| 1, 2 | manual (sin Playwright en este sandbox) | verificado a mano por el humano |

## Historial

- 2026-09-28 · reportado por el humano ("no muestra el iva y no hace el calculo de sumar el
  iva"). Diagnosticado como datos desactualizados en el carrito (localStorage), no un bug de
  fórmula — la reconciliación al abrir el Pedido resuelve la causa real y evita que se repita con
  cualquier cambio futuro de precio/descuento/IVA.
