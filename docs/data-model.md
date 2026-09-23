---
topic: modelo-de-datos-mvp
status: vigente
related: [arch/multitenancy-rls.md, arch/patron-rpc.md, arch/convenciones-sql.md]
---

# Modelo de datos del MVP

Carga solo la sección del módulo que tu historia toca. Toda tabla lleva además `id`,
`tenant_id`, `created_at` y `created_by` (ADR-018; ver arch/convenciones-sql.md). El detalle
fino se fija en la spec de cada historia — esto es el mapa. Visión de conjunto:
arch/diagrama-er.md. Permisos por rol: arch/permisos-roles.md.

Ciclo de negocio que el modelo cubre (ADR-011): comprar materias primas/insumos →
ingresar a inventario → procesar (opcional) → vender a clientes → medir (P&L,
rentabilidad, CxC/CxP).

## Multitenancy (E1)
- `tenants` — name, nit (text, opcional), currency (default 'COP')
- `memberships` — user_id (auth.users), tenant_id, role ('owner'|'admin'|'member'),
  unique(user_id, tenant_id)
- `invitations` — email, role ('admin'|'member'), token (unique), expires_at, accepted_at.
  Solo owner/admin gestionan; se acepta vía RPC `accept_invitation(token)` (spec S1-05).

## Inventario (E2)
- `warehouses` — name; un tenant puede tener varias bodegas
- `products` — sku (unique por tenant), name, description, unit (text),
  kind ('raw'|'finished'|'resale') default 'raw' — materia prima/insumo · terminado propio ·
  comprado para reventa —, cost numeric(14,2) (referencial), price numeric(14,2) (precio de
  venta sugerido), tax_rate numeric(5,2) default 19, min_stock numeric(14,3) default 0, active
- `stock_movements` — product_id, warehouse_id,
  kind ('in'|'out'|'adjust'|'production_in'|'production_out'), qty numeric(14,3),
  unit_cost numeric(14,2), ref_type/ref_id (documento origen: compra, venta, producción,
  ajuste…), note. **Solo se insertan vía RPC `register_movement`** (o RPCs que la componen).
- Vista `current_stock` — stock actual por producto/bodega = agregación de movimientos.
  El stock NUNCA se guarda como columna mutable: siempre derivado.

### Costeo: promedio ponderado (ADR-012) y Kardex
- Costo promedio por producto = `(Σ entradas qty·unit_cost − Σ salidas qty·unit_cost) / stock`,
  derivado de `stock_movements` — nunca columna mutable, igual que el stock.
- Toda salida (venta, consumo de producción) **congela** en su fila el costo promedio del
  momento (`unit_cost`), calculado dentro del RPC → COGS histórico exacto.
- `stock_movements` es el **Kardex** del sistema: libro inmutable de entradas/salidas
  valorizadas con referencia al documento origen. Vista `kardex` por producto: fecha,
  documento, entrada/salida (qty y valor), saldo acumulado (qty y valor) y costo promedio
  resultante. Solo lectura, sin tablas nuevas.

## Compras (E3)
- `suppliers` — name, nit, email, phone, address
- `purchases` — supplier_id, status ('draft'|'ordered'|'received'|'cancelled'),
  issued_at, received_at, subtotal, tax, total (calculados en RPC)
- `purchase_items` — purchase_id, product_id, qty, unit_cost, tax_rate
- RPC `receive_purchase(purchase_id, warehouse_id)` — atómica: status→'received' +
  un `stock_movements` de entrada por ítem + upsert en `supplier_products` (ADR-032).
- `supplier_products` — supplier_id, product_id (unique compuesto), last_purchased_at
  (nullable). Relación proveedor↔producto: sugiere primero en el formulario de orden de
  compra. Se puebla automático al recibir (`receive_purchase`) o a mano desde
  `/compras/proveedores/[id]/productos` (solo owner/admin, ADR-032). Sin soft-delete
  (DELETE físico, es una relación sin historial propio).

## Pagos a proveedores (E4)
- `supplier_payments` — supplier_id, purchase_id (nullable: abonos generales), amount,
  paid_at, method ('cash'|'transfer'|'card'|'other'), note
- RPC `register_supplier_payment` — invariante: pago ≤ saldo pendiente de la compra.
- Vista `supplier_balances` — total comprado, pagado y saldo por proveedor (cuentas por pagar).

## Clientes, ventas y POS — CRM (E5)
- `customers` — name, doc_type ('nit'|'cc'|'ce'|'other'), doc_number, email, phone,
  address, note
- `sales` — customer_id (nullable: venta de mostrador), status
  ('draft'|'confirmed'|'shipped'|'delivered'|'cancelled'), issued_at, subtotal, tax, total
  (calculados en RPC), receipt_number (consecutivo por tenant, asignado en RPC al
  confirmar/registrar; mecánica del contador en la spec de S5-08), cash_session_id
  (nullable: back-office no requiere caja), shipping_address (nullable; UI pre-llena con
  `customers.address`), shipped_at, delivered_at. Flujo: draft → confirmed → shipped →
  delivered; cancelled solo desde draft/confirmed (despachada no se cancela: devoluciones
  en Fase 2). Transiciones válidas garantizadas en BD (RPC ligera o trigger — lo decide la
  spec de S5-06) + pgTAP.
- `sale_items` — sale_id, product_id, qty, unit_price, discount numeric(14,2) default 0
  (monto por línea; % se convierte en UI — precio de lista intacto: descuentos trazables
  por producto, reporte en Finanzas), tax_rate, unit_cost (costo promedio congelado al
  confirmar → base de rentabilidad)
- `customer_payments` — customer_id, sale_id (nullable: abonos), cash_session_id (nullable:
  cobros de mostrador cuentan para el arqueo), amount, paid_at,
  method ('cash'|'transfer'|'card'|'other'), note
- `cash_sessions` — opened_by (user_id), opened_at, opening_amount (base de caja),
  status ('open'|'closed'), closed_at, counted_amount (contado al cierre), expected_amount
  (calculado en RPC), difference (contado − esperado), note.
  Invariante: un usuario no puede tener dos sesiones abiertas.
- RPC `confirm_sale(sale_id, warehouse_id)` — atómica: valida stock, congela `unit_cost`,
  genera salidas de stock, status→'confirmed'. Invariantes: stock ≥ 0, no confirmar dos veces.
- RPC `register_customer_payment` — invariante: pago ≤ saldo de la venta.
- RPC `register_pos_sale` — venta de mostrador en un solo paso atómico: crea venta + ítems
  (con descuentos), asigna consecutivo, congela costos y descuenta stock (reutiliza la
  lógica de `confirm_sale`), registra pagos (mixtos permitidos) y liga a la sesión de caja.
  Invariantes: sesión abierta del usuario; Σ pagos = total; stock ≥ 0.
- RPC `open_cash_session(opening_amount)` / `close_cash_session(counted_amount)` — el cierre
  calcula el esperado (base + cobros en efectivo de la sesión) y registra la diferencia;
  no se cierra dos veces ni se vende contra sesión cerrada.
- `customer_interactions` — customer_id, kind ('note'|'followup'|'complaint'|'promo'),
  note, occurred_at. Postventa y mercadeo: cierra el ciclo CRM (antes: pedido draft ·
  durante: confirmed/pagos · después: shipped/delivered · postventa: interacciones).
- Vistas: `customer_balances` (cuentas por cobrar), `customer_history` (CRM: compras,
  frecuencia, ticket promedio, última compra — derivado de `sales`, sin tablas extra) y
  `cash_session_summary` (por sesión: ventas, cobros por método, esperado vs contado,
  diferencia — base del arqueo).

## Producción (E6) — ADR-013
- `recipe_items` — product_id (terminado), component_product_id, qty (por unidad producida).
  Una sola tabla: "el producto tiene receta" = existen filas aquí. Receta **opcional**.
- `productions` — output_product_id, output_qty, warehouse_id, produced_at, note
- `production_items` — production_id, product_id (insumo consumido), qty,
  unit_cost (promedio congelado)
- RPC `register_production` — atómica: consume insumos (salidas `production_out` con costo
  congelado), costo unitario del terminado = Σ costos consumidos / output_qty, genera entrada
  `production_in`. Con receta la UI pre-llena consumos; el usuario puede ajustarlos
  (transformación libre). Invariantes: stock de insumos ≥ 0, output_qty > 0.

## Gastos y contabilidad derivada (E7) — ADR-014
- `expenses` — kind ('fixed'|'variable') — fijo: arriendo, nómina; variable: fletes,
  comisiones, empaques —, category (text libre, sugerencias en UI), description, amount,
  paid_at, method, supplier_id (nullable).
- **Sin plan de cuentas ni asientos**: todo reporte es vista/consulta sobre operaciones.
  - `monthly_expenses` — agregación por mes × categoría × kind: base de las gráficas de la
    página Finanzas (evolución por categoría, fijo vs variable, comparativa mes a mes,
    % de gastos sobre ingresos cruzando con `monthly_pnl`).
  - `monthly_pnl` — ingresos (ventas confirmadas) − COGS (Σ `sale_items.qty·unit_cost`)
    − gastos (`expenses`) = utilidad. La compra NO es gasto (va a inventario): el costo se
    reconoce al vender (COGS).
  - `product_profitability` — por producto: unidades vendidas, ingreso, costo, margen $ y %.
  - `cash_flow` — entradas de caja (`customer_payments`) vs salidas
    (`supplier_payments` + `expenses`).
  - Top/bottom vendidos y más rentables: consultas sobre `sale_items` (dashboard, E8).
- UI: la página **Finanzas** (E7) reúne las gráficas de gastos, P&L y rentabilidad por
  producto; el dashboard (E8) solo tarjetas resumen con enlace a ella.

## Dashboard (E8)
Sin tablas nuevas: vistas/consultas de agregación (valor de inventario al costo, ventas y
compras del mes, utilidad, CxC/CxP, top vendidos y más rentables, bajo min_stock).
Tarjetas resumen: el análisis gráfico profundo vive en la página Finanzas (E7).

## Supuestos del MVP (ADR-018)
- Reportes mensuales en zona horaria `'America/Bogota'`.
- Unidades sin conversión: cada producto se cataloga en la unidad en que se consume/vende;
  conversiones → Fase 2. Sin adjuntos/fotos (Supabase Storage) en el MVP → Fase 2.

## Fase 2 (NO construir, solo no cerrar puertas)
Facturación electrónica DIAN (por eso `nit`/`doc_number` existen desde ya), partida doble
formal (los reportes derivados son su semilla), app móvil de bodega, multi-moneda real,
reportes exportables, automatización de pedidos y mensajería (WhatsApp/e-commerce: el canal
crea `sales` en draft vía las mismas RPCs y registra `customer_interactions`), devoluciones
de venta, activos fijos/depreciación (en MVP los equipos duraderos —marcos, alzas— se
registran como `expenses` categoría equipos, o como insumo si se consumen), gastos
recurrentes y presupuestos (plantilla de fijos esperados con detección de anomalías:
fijo no registrado o con desviación del monto).
