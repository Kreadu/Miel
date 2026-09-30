---
id: S18-06
titulo: Venta de mostrador en un paso — "Cobrar y entregar" desde el carrito
estado: implemented
depende_de: [S19-35, S23-01, S20-02]
---

# S18-06 — Cobrar y entregar en un paso

## Contexto

Pedido del humano (2026-09-30): una venta de mostrador pagada en el momento hoy exige carrito →
"Confirmar pedido" (queda en borrador) → "Confirmar" (elegir bodega) → "Registrar cobro" (volver a
elegir forma de pago y monto) → "Entregar directamente". La forma de pago del carrito es solo
descriptiva (S19-08) y se pide dos veces.

Decisiones del humano:
- El cobro de "Cobrar y entregar" es siempre por el **total**; pagos parciales siguen por el
  camino actual.
- El botón aparece solo con entrega **"Retiro en tienda"**.
- Bodega: el trabajador tiene una bodega o sucursal habitual en su ficha, pero puede trabajar en
  otra (p. ej. por horas). **Supuesto (a confirmar al aprobar):** en el carrito aparece "Sale de"
  con la bodega **preseleccionada** — la del trabajador identificado en modo tienda; si no hay
  trabajador o no tiene bodega, la principal — y se puede cambiar. La ficha queda como bodega
  habitual; no se agrega nada al modelo de datos. (Aprobado por el humano.)
- **Comprobante (aprobado 2026-09-30):** selector Boleta / Factura. Miel no emite factura
  electrónica DIAN (ADR-006; historia aparte). "Factura" exige un cliente identificado (no el
  genérico, con número de documento) y deja la venta como **factura por emitir**; el dueño la
  emite en su sistema de facturación y la marca como emitida en Miel. "Boleta" = el consecutivo
  interno de siempre.

## Alcance

- RPC nueva `checkout_counter_sale` (una transacción): crea la venta con los mismos datos y
  validaciones de `create_sale`, la confirma en la bodega elegida (stock, boleta, caja abierta
  como `confirm_sale`), registra el cobro por el total con la forma de pago elegida y la marca
  entregada. Si cualquier paso falla, no queda nada guardado.
- Migración: `sales.document_type` (`boleta`/`factura`, por defecto `boleta`) y
  `sales.invoice_issued_at`. RPC `mark_invoice_issued(p_sale_id)` (owner/admin, solo facturas
  no anuladas).
- `checkout_counter_sale` recibe el comprobante; con factura valida el cliente
  (`invoice_customer_required`).
- Pedidos: sección **"Facturas por emitir"** (owner/admin) con "Marcar emitida".
- Acción `checkoutCounterSale` (Zod + claves de error, ADR-040) y `logActivity` de venta y cobro.
- Carrito de Pedidos: con "Retiro en tienda", selector "Sale de" (bodega preseleccionada) y
  botón principal **"Cobrar y entregar"** que exige forma de pago. "Guardar como pedido" (el flujo
  actual, borrador) sigue disponible para quien no paga ahora.
- Textos en es/en/fr.

Fuera de alcance: pagos parciales, envíos (siguen el flujo actual), cambiar el modelo de bodega
del trabajador.

## Criterios

- Retiro en tienda + forma de pago + bodega → un clic: venta entregada, cobrada por el total,
  stock descontado en esa bodega, boleta generada; no aparece en "Pedidos por completar" y sí en
  el historial del cliente y en la caja.
- Sin forma de pago, el botón no se puede usar (mensaje claro).
- Factura con "Mostrador / sin cliente" o con un cliente sin documento: error y nada guardado.
- Factura cobrada aparece en "Facturas por emitir" hasta que se marca emitida; un operativo no
  puede marcarla.
- Sin caja abierta con productos de tienda: error "Abre tu caja…" y **nada** guardado.
- Sin stock: error y nada guardado.
- La bodega viene preseleccionada según la regla de arriba y se puede cambiar.
- Tests: pgTAP de la RPC (éxito, atomicidad ante stock insuficiente y caja cerrada, aislamiento
  de tenant); Vitest de la acción (claves de error, validación).
- Lint, tsc, `npm test`; pgTAP y migración los corre/aplica el humano (sin Supabase CLI aquí).

## Notas de implementación

- Migración `20260930180000_cobrar-y-entregar.sql`: columnas `sales.document_type` e
  `invoice_issued_at`; RPCs `checkout_counter_sale` (reutiliza `create_sale`, `confirm_sale`,
  `register_customer_payment`, `mark_sale_delivered` en una sola transacción),
  `mark_invoice_issued` y `default_sale_warehouse` (agregada al implementar: en modo tienda el
  trabajador no puede leer su ficha por los salarios; la función devuelve solo el id de su bodega
  o la principal). Tipos de `database.types.ts` editados a mano (sin Supabase CLI).
- pgTAP `supabase/tests/S18-06-cobrar-y-entregar.sql` (24 pruebas) **sin correr aquí** (sin
  Docker ni Supabase CLI): lo corre el humano.
- El botón del flujo de siempre pasa a llamarse "Guardar como pedido" (antes "Confirmar pedido",
  que no confirmaba: dejaba borrador).
- "Facturas por emitir" vive en Pedidos (solo owner/admin).
