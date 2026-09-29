---
id: S19-07
titulo: "Ver pedido" del catálogo va a /ventas/pedidos, no a una ruta aparte
estado: implemented
depende_de: [S19-06]
---

# S19-07 — "Ver pedido" del catálogo va a `/ventas/pedidos`, no a una ruta aparte

## Contexto y valor

S19-06 creó `/ventas/catalogo/pedido` como página separada para revisar el carrito. El dueño
notó que ya existía "Pedidos" (con ícono de carrito) en `/ventas`, y pidió unificar: apretar "Ver
pedido" debe llevar a la página de Pedidos que ya existe, no a una tercera ruta con un nombre
parecido.

## Alcance

- Se borra `/ventas/catalogo/pedido` (la página y su componente).
- El componente del carrito (renombrado `CatalogPedidoCart`) se muda a
  `ventas/pedidos/catalog-pedido-cart.tsx` y se renderiza **dentro de `/ventas/pedidos`**, arriba
  de `SaleForm` y del listado — sin tocar nada de lo que ya había ahí (S5-02 y todo lo que se
  construyó encima: confirmar, despachar, cobrar).
- Si no hay carrito armado (nadie vino del catálogo), el componente no renderiza nada — la página
  se ve exactamente igual que antes de S19-06.
- `use-catalog-cart.ts` sube un nivel (de `ventas/catalogo/` a `ventas/`) porque ahora lo usan dos
  subcarpetas distintas (`catalogo/` y `pedidos/`).
- "Ver pedido (N)" en el catálogo y la navegación al agregar un producto apuntan a
  `/ventas/pedidos`.
- Al confirmar el pedido, ya no hay `router.push` (no hace falta, ya está en la página) — solo se
  vacía el carrito; el listado de abajo se refresca solo (`revalidatePath` de `createSale`, sin
  cambios).
- **Corrección 2026-09-28 (mismo día):** "Agregar al pedido" ya NO navega — solo suma al carrito
  y el humano se queda viendo el catálogo (probó el primer intento y cada click lo sacaba del
  catálogo, pidió quedarse ahí). Ir a `/ventas/pedidos` es una acción aparte, con el botón
  "Ver pedido (N)".

## NO-alcance (explícito)

- `SaleForm` (alta manual por dropdown) sigue exactamente igual, sin cambios — ambos caminos
  (manual y desde el catálogo) conviven en la misma página.

## Criterios de aceptación

1. **Dado** un producto agregado desde `/ventas/catalogo` **cuando** se aprieta "Agregar al
   pedido" o "Ver pedido" **entonces** la app navega a `/ventas/pedidos` y ahí se ve el carrito.
2. **Dado** alguien que entra a `/ventas/pedidos` sin haber tocado el catálogo **entonces** ve la
   página exactamente como antes (sin el panel de carrito).
3. **Dado** un pedido armado **cuando** se confirma **entonces** el carrito se vacía y el pedido
   aparece en el listado de la misma página, sin recargar manualmente.

## Plan de tests

| Criterio | Tipo | Qué verifica |
|---|---|---|
| 1–3 | manual (sin Playwright en este sandbox) | verificado a mano por el humano |

## Historial

- 2026-09-28 · pedido por el humano ("al apretar VER PEDIDO debe enviarnos a la pagina de
  PEDIDOS así como la armaste") tras ver que S19-06 había creado una ruta separada en vez de
  reusar la página de Pedidos que ya existía.
