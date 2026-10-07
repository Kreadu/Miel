---
id: S27-02
titulo: Tienda en línea — carrito y pedido como invitado
estado: implemented
depende_de: [S27-01]
---

# S27-02 — Carrito y pedido como invitado

## Contexto y valor
Con S27-01 el cliente ve el catálogo, pero no puede comprar. Esta historia agrega el carrito y el
"Hacer pedido". El cliente deja sus datos, elige entrega y forma de pago, y el pedido entra a
Miel en Vender → Pedidos, donde la empresa lo confirma con el flujo que ya existe (elegir bodega,
cobrar y entregar). Las instrucciones y el comprobante de pago son S27-03; el seguimiento y el
aviso al negocio, S27-04.

## Supuestos (decididos por el agente, confirmar al aprobar)
- **F1 · Entrega:** "Recoger en la tienda" o "Envío a domicilio". El envío entra con costo $0 y la
  nota "costo a confirmar": la empresa lo ajusta al confirmar el pedido. Calcular el envío por
  km o peso desde la tienda queda para después, porque el cliente no sabe sus km.
- **F2 · Forma de pago preferida:** Nequi, Daviplata, transferencia, contra entrega o pagar al
  recoger (esta última solo si recoge). Queda guardada en el pedido. El cobro real se registra en
  Miel como hoy (S18-07/08).
- **F3 · El pedido entra como borrador** (`draft`, igual que un pedido interno): no descuenta stock
  hasta que la empresa lo confirma. En la lista de Pedidos lleva la marca "Tienda en línea" con el
  teléfono del cliente. Al pedir se valida que cada producto siga disponible, pero no se reserva.
- **F4 · Cliente:** se busca por teléfono dentro de la empresa. Si existe, el pedido se le asigna
  sin cambiar sus datos; si no, se crea con nombre, teléfono, correo y dirección.
- **F5 · Anti-abuso:**
  - un campo trampa invisible (honeypot);
  - máximo 3 pedidos por teléfono cada 10 minutos y 100 por tienda por hora;
  - máximo 30 productos distintos y 99 unidades por producto;
  - los precios se calculan en la BD, nunca desde el navegador.
- **F6 · Carrito:** se guarda en el navegador del cliente, por tienda. Si el navegador no deja
  guardar, el carrito funciona igual mientras la página esté abierta.
- **F7 · Autoría:** los pedidos y clientes que llegan de la tienda no tienen un usuario de Miel que
  los cree. `sales.created_by` y `customers.created_by` pasan a admitir vacío, y `sales.source`
  dice `store`.

## Alcance
- **Tienda:**
  - Botón "Agregar" en cada producto disponible (los agotados no se pueden agregar).
  - Icono de carrito con contador en el encabezado.
  - Página `/tienda/[direccion]/carrito`: cantidades (+/−), quitar, total estimado con IVA y el
    formulario de pedido (nombre, celular, correo opcional, entrega, dirección si es envío, forma
    de pago, nota).
  - Al enviar: pantalla "¡Pedido recibido!" con el código (`#` y 8 caracteres), el resumen y el
    contacto de la empresa (llamar y WhatsApp).
- **BD:**
  - `sales.source` (`internal` | `store`, por defecto `internal`) y `sales.store_payment`.
  - `created_by` admite vacío en `sales` y `customers`.
  - RPC `place_store_order(p_slug, p_customer jsonb, p_items jsonb, p_delivery text,
    p_payment text, p_address text, p_note text) → (order_code text, total numeric)`, con
    `grant execute` a `anon`.
- **Miel:** en Vender → Pedidos, los pedidos de la tienda muestran la marca "Tienda en línea", el
  teléfono, la forma de pago preferida y "envío a confirmar".
- Textos es/en/fr.

## NO-alcance (explícito)
- Instrucciones de pago y comprobante (S27-03), enlace de seguimiento y aviso al negocio (S27-04),
  pago en línea (S27-05), cálculo del envío en la tienda, cupones, reserva de stock, cuentas de
  cliente.

## Criterios de aceptación
1. **Dado** un visitante con 2 productos en el carrito **cuando** completa nombre, celular,
   entrega y pago y envía **entonces** ve "¡Pedido recibido!" con su código y el total. En Miel
   aparece un pedido en borrador marcado "Tienda en línea", con sus productos, precios de la BD y
   el cliente creado o encontrado por teléfono.
2. **Dado** un producto que se agotó o se desactivó mientras estaba en el carrito **cuando**
   envía **entonces** el pedido no se crea y el cliente ve cuál producto ya no está disponible.
3. **Dado** que se manipula el precio o la cantidad desde el navegador, se piden más de 99
   unidades, se usa una tienda apagada o se llena el campo trampa **entonces** el pedido se
   rechaza (o, en el caso de la trampa, se ignora sin crear nada).
4. **Dado** un cuarto pedido del mismo teléfono en 10 minutos **entonces** se rechaza con "Ya
   recibimos tus pedidos; espera unos minutos".
5. En 375px el carrito y el formulario caben en una columna, con botones de al menos 40px y sin
   scroll horizontal. El carrito sobrevive a recargar la página.

## Modelo de datos y migraciones
Migración `20261007150000_pedido-tienda.sql`:
```sql
alter table sales add column source text not null default 'internal' check (source in ('internal','store')),
  add column store_payment text check (store_payment in ('nequi','daviplata','transfer','cash_on_delivery','in_store'));
alter table sales alter column created_by drop not null;
alter table customers alter column created_by drop not null;
create index sales_store_recent_idx on sales (tenant_id, created_at) where source = 'store';
```

## Políticas RLS requeridas
Sin cambios. `anon` no recibe políticas: solo ejecuta `place_store_order` (security definer).

## Funciones RPC e invariantes
`place_store_order` (security definer, atómica):
- La tienda existe y está activa; si no, `store_unavailable`.
- Cliente: nombre de 2 a 80 caracteres y celular de 7 a 15 dígitos (si no, `customer_invalid`);
  correo y dirección opcionales con largo máximo. Si la entrega es envío, la dirección es
  obligatoria (`address_required`).
- Ítems: de 1 a 30, sin productos repetidos, cantidad entera de 1 a 99. Cada producto tiene que
  ser de la tienda, estar activo, ser de inventario "productos", tener canal internet o ambos,
  precio mayor a 0 y stock mayor a 0. Si no: `product_unavailable:<nombre>`.
- Precio, descuento e IVA salen de `products` (se ignora cualquier precio que mande el navegador).
  El descuento se calcula igual que la tienda: `round(qty·price·%/100)`.
- Límites: más de 3 pedidos del mismo teléfono en 10 minutos o más de 100 en la tienda en una hora
  → `too_many_orders`.
- `delivery` en (`pickup`, `delivery`) se guarda como `pickup` o `agreed` con costo 0. `payment`
  en la lista de F2; `in_store` solo con `pickup`.
- Inserta el cliente (si es nuevo), la venta en `draft` con `source='store'` y sus ítems, y
  devuelve el código (primeros 8 caracteres del id, en mayúsculas) y el total.

## Casos borde
- Teléfono con espacios o +57: se normaliza a dígitos para buscar al cliente y contar los límites.
- El mismo producto dos veces en el carrito: el navegador lo suma; si llega repetido, se rechaza.
- La tienda se apaga mientras el cliente tiene el carrito → `store_unavailable`.
- Doble clic en "Hacer pedido": el botón se desactiva mientras envía; los límites cubren el resto.

## Consideraciones de seguridad
- Primera escritura anónima de Miel: todo pasa por una RPC con validación explícita de cada campo
  y límites de tamaño (Zod en la server action y otra vez en la BD).
- Los precios se calculan en la BD. Los límites por teléfono y por tienda frenan el spam;
  CAPTCHA queda anotado si hace falta.
- Lo que escribe el cliente es dato, nunca instrucción: se muestra escapado en Miel. Errores
  genéricos, salvo "producto no disponible".
- No se revelan datos de otros clientes: si el teléfono ya existe, no se le dice nada al visitante.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S27-02-pedido-tienda.sql | anon crea un pedido: venta en draft source=store, precios de la BD, cliente nuevo o existente por teléfono |
| 2,3 | pgTAP | (mismo) | agotado, inactivo, solo tienda, ajeno, repetido, qty>99, tienda apagada, envío sin dirección, in_store con envío; atomicidad (nada a medias) |
| 4 | pgTAP | (mismo) | cuarto pedido del mismo teléfono → too_many_orders |
| 1–4 | Vitest | src/actions/store-order.test.ts | Zod, honeypot, mapeo de errores |
| 5 | Vitest | src/lib/store/cart.test.ts | sumar, cambiar cantidad, tope 99, quitar, total estimado; leer y guardar con almacenamiento roto |

El humano aplica la migración, corre el pgTAP y prueba el pedido desde el celular (regla 9).

## Historial
- 2026-10-07 · creada (draft) con supuestos F1–F7 pendientes de confirmar.
- 2026-10-07 · aprobada por el humano con F1–F7 tal cual.
- 2026-10-07 · implementada. `normalize_phone` (quita +57) para buscar clientes y contar límites.
  Acción `src/actions/store-order.ts`; carrito en `src/lib/store/cart.ts` + `use-cart.ts`
  (useSyncExternalStore sobre localStorage); página `/tienda/[slug]/carrito`; marca "Tienda en
  línea" en Pedidos. pgTAP 26/26 en PGlite con stubs; lint, tsc, `npm test` 555/555, `next build` ✓.
  **Falta:** aplicar la migración (hasta entonces Pedidos sale vacío), `supabase test db`, probar un
  pedido real desde el celular.
