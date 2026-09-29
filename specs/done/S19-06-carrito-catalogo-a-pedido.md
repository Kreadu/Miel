---
id: S19-06
titulo: Carrito del Catálogo — arma un Pedido y lo confirma con create_sale
estado: implemented
depende_de: [S19-02, S5-02]
---

# S19-06 — Carrito del Catálogo: arma un Pedido y lo confirma con `create_sale`

## Contexto y valor

El dueño pidió que, al apretar un producto del catálogo, se arme un "pedido" (le llamó también
"carrito de compra", pidió que le llamemos "pedido" o "carrito" de ahora en más) con la lista de
productos elegidos, sus precios/descuentos, la cantidad que se desee de cada uno, y el cliente al
que se le asigna.

**Hallazgo clave antes de implementar:** esto ya existe casi entero — `/ventas/pedidos` (S5-02)
ya es exactamente "armar un pedido": elige cliente, agrega ítems con cantidad/precio/descuento/IVA,
y `createSale`/`create_sale` (RPC) lo crea como venta en `draft`. Lo único que falta es una forma
más cómoda de entrar ahí **desde el catálogo, con los productos ya elegidos**, en vez de tener que
buscarlos uno por uno en un `<select>`. Por eso esta historia es solo una capa de UI nueva sobre
lo que ya existe — cero tablas nuevas, cero RPC nueva.

## Alcance

- `use-catalog-cart.ts`: hook cliente, carrito en `localStorage` (clave por `tenantId`, para no
  mezclar carritos si el usuario cambia de empresa). Guarda `{productId, name, price,
  discountPercent, taxRate, qty}[]`.
- `CatalogCard` gana un botón **"Agregar al pedido"** (visible a cualquier rol del tenant —
  `member` ya puede crear ventas hoy, `create_sale` no exige admin — a diferencia de
  Editar/Eliminar que sí siguen siendo solo owner/admin). Al apretarlo: suma el producto al
  carrito (o le suma 1 a la cantidad si ya estaba) y navega a la nueva página del pedido.
- Nueva página `/ventas/catalogo/pedido`: lee el carrito, muestra la lista editable (cantidad por
  línea, quitar línea), el total estimado, un selector de cliente (mismo patrón que `SaleForm` —
  "Mostrador / sin cliente" por defecto) y nota opcional. "Confirmar pedido" arma el mismo JSON de
  ítems que ya arma `SaleForm` y llama a **la misma Server Action `createSale`** (sin duplicar
  validación, RPC, ni lógica de negocio) — al confirmar, limpia el carrito y redirige a
  `/ventas/pedidos`, donde el pedido recién creado sigue el flujo ya existente (confirmar,
  despachar, cobrar).

## NO-alcance (explícito)

- **Nada de la lógica de ventas cambia**: `create_sale`, `sale_items`, confirmar/despachar/cobrar
  siguen exactamente igual — esta historia es un atajo de entrada, no un sistema paralelo.
- **Checkout/pago en el carrito**: sigue sin existir (pagos pospuestos). El carrito termina en un
  pedido `draft`, igual que hoy crear uno a mano en `/ventas/pedidos`.
- Carrito compartido entre dispositivos/persistente en el servidor: vive en `localStorage` del
  navegador — se pierde si se borra el sitio o se usa otro dispositivo (aceptable para el alcance
  de "armar un pedido en la misma sesión de trabajo").

## Criterios de aceptación

1. **Dado** cualquier rol **cuando** aprieta "Agregar al pedido" en una tarjeta del catálogo
   **entonces** el producto se suma al carrito y la app navega a `/ventas/catalogo/pedido`.
2. **Dado** un carrito con productos **cuando** entra a `/ventas/catalogo/pedido` **entonces** ve
   cada línea con su precio/descuento, puede cambiar la cantidad o quitar la línea, y ve el total
   estimado.
3. **Dado** un pedido armado **cuando** elige un cliente (o deja "Mostrador") y aprieta "Confirmar
   pedido" **entonces** se crea la venta (misma `create_sale` de siempre) y aparece en
   `/ventas/pedidos` con el cliente asignado.
4. **Dado** un carrito vacío **cuando** entra a `/ventas/catalogo/pedido` **entonces** ve un
   mensaje invitando a volver al catálogo, sin poder confirmar nada.

## Plan de tests

| Criterio | Tipo | Qué verifica |
|---|---|---|
| 1–4 | manual (sin Playwright en este sandbox) | verificado a mano por el humano — sin migración nueva, no depende de aplicar nada en Supabase |

## Historial

- 2026-09-28 · aprobada por el humano en la misma sesión. El humano pidió unificar el nombre
  ("pedido" o "carrito"); se usó "Pedido" para no crear un segundo término compitiendo con
  `/ventas/pedidos`, que ya es el mismo concepto.
