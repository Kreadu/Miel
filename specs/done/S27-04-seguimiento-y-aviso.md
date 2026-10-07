---
id: S27-04
titulo: Tienda en línea — seguimiento del pedido y aviso al negocio
estado: implemented
depende_de: [S27-03]
---

# S27-04 — Seguimiento del pedido y aviso al negocio

## Contexto y valor
Hoy el cliente ve su pedido solo en la pantalla de "¡Pedido recibido!": si la cierra, pierde el
rastro y la posibilidad de subir el comprobante. Y la empresa solo se entera de un pedido nuevo si
entra a Pedidos. Esta historia da al cliente un enlace secreto para seguir su pedido, y avisa a la
empresa dentro de Miel (y por correo cuando haya servidor de correo).

## Supuestos (decididos por el agente, confirmar al aprobar)
- **H1 · Enlace de seguimiento** `/tienda/<direccion>/pedido/<llave>`. Usa la misma llave secreta
  de S27-03. Aparece en la pantalla de éxito con "Copiar enlace" y va dentro del mensaje de
  WhatsApp a la tienda. Además, el navegador del cliente recuerda sus últimos 10 pedidos de esa
  tienda, y el encabezado muestra "Mis pedidos" si hay alguno.
- **H2 · Qué ve el cliente:**
  - código y fecha del pedido;
  - estado como línea de tiempo: Recibido → Confirmado → Enviado → Entregado, o Cancelado;
  - productos con cantidad y valor, envío (si la empresa ya lo puso) y total;
  - forma de entrega y forma de pago elegidas;
  - estado del pago: Pendiente, Comprobante enviado o Pagado (cuando los cobros cubren el total).

  Mientras no esté pagado ni cancelado, puede ver las instrucciones de pago y subir el
  comprobante, con el tope de 5 subidas de S27-03.
- **H3 · Privacidad:** la página no muestra nombre, teléfono ni dirección del cliente (por si el
  enlace se comparte), y no la indexan los buscadores.
- **H4 · Aviso dentro de Miel:** quien ve Vender recibe en la parte de arriba de Miel el aviso
  "Tienes N pedidos nuevos de la tienda en línea → Ver pedidos", con el mismo estilo que el de
  agotados pero en el color de la marca, no en rojo. "Nuevo" significa un pedido de la tienda que
  sigue en borrador. Desaparece cuando la empresa lo confirma o lo cancela.
- **H5 · Correo:** si Miel tiene configurado el envío de correo (`RESEND_API_KEY`) y la empresa
  tiene correo en Mi empresa, se le manda un correo "Pedido nuevo #CODIGO" con el total y un enlace
  a Pedidos. Hoy no hay llave, así que no se envía nada y no falla; queda listo para el servidor.

## Alcance
- **BD:** RPC `store_order_status(p_slug, p_token) → jsonb`, security definer y grant a anon.
  Devuelve código, fecha, estado, ítems, totales, entrega, forma de pago, estado del pago, si se
  puede subir comprobante y las formas de pago de la tienda (para las instrucciones).
- **Tienda:**
  - página de seguimiento, con las instrucciones y la subida de S27-03 reutilizadas;
  - enlace "Seguir mi pedido" en la pantalla de éxito;
  - "Mis pedidos" en el encabezado (guardado en el navegador del cliente).
- **Miel:** aviso de pedidos nuevos en el layout; correo opcional a la empresa desde la server
  action del pedido.
- Textos es/en/fr.

## NO-alcance (explícito)
- Notificaciones push o SMS, WhatsApp automático (requiere la API de WhatsApp Business), cuentas
  de cliente, servidor central (S27-07, pospuesta).

## Criterios de aceptación
1. **Dado** un pedido recién hecho **cuando** el cliente abre su enlace de seguimiento (aunque
   haya cerrado la página) **entonces** ve su código, productos, total, "Recibido" y "Pago
   pendiente", y puede subir el comprobante.
2. **Dado** que la empresa confirma, envía o entrega el pedido en Miel, o registra cobros por el
   total **entonces** el seguimiento muestra el estado nuevo y "Pagado", y ya no ofrece subir
   comprobante.
3. **Dado** una llave inventada, la llave de otra tienda o una dirección distinta **entonces** la
   página dice "Pedido no encontrado" y no revela nada.
4. **Dado** un pedido nuevo de la tienda **cuando** alguien con acceso a Vender abre Miel
   **entonces** ve "Tienes 1 pedido nuevo de la tienda en línea"; al confirmarlo, el aviso
   desaparece. Un operativo sin el módulo Vender no lo ve.
5. En 375px la línea de tiempo y el detalle caben sin scroll horizontal.

## Modelo de datos y migraciones
Migración `20261007170000_seguimiento-pedido.sql`: solo la función `store_order_status`. Sin tablas ni columnas.

## Políticas RLS requeridas
Sin cambios. El aviso de Miel cuenta `sales` con la RLS existente.

## Funciones RPC e invariantes
`store_order_status(p_slug text, p_token uuid) → jsonb`:
- Responde solo si la tienda está activa, el pedido es de esa tienda y `source='store'`. Si no,
  devuelve null.
- Pagado = suma de `customer_payments` del pedido mayor o igual al total.
- `can_upload` = no pagado, no cancelado y menos de 5 subidas.
- Nunca incluye datos del cliente ni ids internos.

## Casos borde
- El pedido se cancela: estado "Cancelado", sin instrucciones de pago.
- La empresa agrega el costo del envío al confirmar: el total cambia y se muestra.
- La tienda se apaga después del pedido: el seguimiento dice "Pedido no encontrado" (la tienda
  está cerrada); el cliente usa el WhatsApp o el teléfono de la empresa.
- El navegador no deja guardar "Mis pedidos": no aparece la lista y todo lo demás funciona.

## Consideraciones de seguridad
- La llave secreta (UUID aleatorio) es la única forma de ver el pedido; las respuestas son iguales
  para "no existe" y "no es de esta tienda".
- Sin datos personales en la página ni en la respuesta de la RPC. `robots: noindex`.
- El correo a la empresa se arma con textos escapados; la llave del cliente no va en el correo.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1,2,3 | pgTAP | supabase/tests/S27-04-seguimiento.sql | estado, ítems y totales; pagado por cobros; can_upload; llave falsa o de otra tienda → null; sin datos personales |
| 4 | Vitest | src/lib/store/order-status.test.ts | línea de tiempo y estado del pago derivados |
| 1 | Vitest | src/lib/store/my-orders.test.ts | "Mis pedidos" en el navegador: guardar, tope de 10, almacenamiento roto |
| 5 | Vitest | src/lib/email/store-order-email.test.ts | correo con código y total, sin la llave del cliente, textos escapados |

El humano aplica la migración y prueba el seguimiento y el aviso en el celular (regla 9).

## Historial
- 2026-10-07 · creada (draft) con supuestos H1–H5 pendientes de confirmar.
- 2026-10-07 · aprobada por el humano con H1–H5 tal cual.
- 2026-10-07 · implementada. Página `/tienda/[slug]/pedido/[token]` (reutiliza las instrucciones y la
  subida de S27-03), `/tienda/[slug]/mis-pedidos` y enlace en el encabezado, enlace de seguimiento y
  "Copiar" en la pantalla de éxito (también dentro del WhatsApp), aviso "pedidos nuevos" en el layout
  de Miel (módulo ventas) y correo opcional (`src/lib/email/store-order-email.ts`, inactivo sin
  `RESEND_API_KEY`). pgTAP 16/16 (+ S27-01..03 en verde) en PGlite; lint, tsc, `npm test` 581/581,
  `next build` ✓. **Falta:** aplicar la migración y probar en el celular.
