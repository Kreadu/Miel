---
id: S28-01
titulo: Recepción de compras con la factura del proveedor, línea por línea y parcial
estado: implemented
depende_de: [S3-03, S26-02, S23-01]
---

# S28-01 — Recepción con factura, línea por línea y parcial

## Contexto y valor
Hoy "Recibir" mete toda la orden de una vez, sin la factura del proveedor y al costo de la orden.
En la bodega lo real es otro: se revisa físicamente lo que llegó, se ingresa la factura (número,
fechas, valores y el archivo si es digital), se confirma producto por producto, a veces no llega
todo y a veces el precio cambió. Esta historia lleva eso a Miel. Cada línea que se guarda entra de
inmediato al inventario a su costo real, sin IVA (ADR-038), y la deuda con el proveedor sale de
lo que dice la factura.

## Supuestos (decididos por el agente, confirmar al aprobar)
- **R1 · Método de costo:** se mantiene el **promedio ponderado** (ADR-038). El kardex conserva el
  costo real de cada entrada. **Confirmar con la contadora**: si usa PEPS, se crea una historia
  aparte.
- **R2 · Quién recibe:** quien hoy puede recibir (cualquier miembro de la empresa) confirma las
  cantidades. El **costo** solo lo ven y lo cambian el dueño y los administradores (ADR-029).
  Si recibe un miembro, la línea entra al costo de la orden y el dueño la corrige después con R6.
- **R3 · Deuda con el proveedor:** una orden con al menos una factura debe el **total de sus
  facturas**, tal como lo escribe la persona. Si ese total no coincide con las líneas recibidas
  más el IVA, Miel lo avisa pero deja guardar. Las órdenes sin factura (las de antes, o las
  ordenadas que aún no llegan) siguen como hoy, con `purchases.total`.
- **R4 · Faltantes, según lo que diga el proveedor:**
  - **"Queda pendiente":** la orden queda en *Recibida parcial* y se puede seguir recibiendo
    después, incluso con otra factura.
  - **"Cerrar con faltantes":** la orden pasa a *Recibida* con una nota opcional, lo que no llegó
    queda anotado como faltante y, si hace falta, se crea una orden nueva.
- **R5 · Factura:** una orden puede tener varias facturas (entregas parciales). Datos:
  - número (con prefijo), único por proveedor;
  - fecha de emisión y fecha de vencimiento (opcional);
  - CUFE (opcional);
  - subtotal, IVA y total;
  - bodega de destino;
  - archivo opcional (PDF, XML, ZIP de la factura electrónica o foto; máximo 10 MB) en un bucket
    privado, con el mismo patrón de S27-03.
- **R6 · Error al guardar una línea:** el dueño o un administrador puede **anular una línea
  recibida**. Eso genera una salida en el kardex al mismo costo con el que entró y devuelve la
  cantidad a "pendiente". No se puede anular si ya no hay stock suficiente en esa bodega.
- **R7 · Línea con otro precio:** el costo sin IVA viene precargado con el de la orden y se puede
  cambiar. El IVA de la línea viene con la tasa de la orden y también se puede cambiar. El
  **precio de venta y el historial de precios del proveedor son S28-02**: esta historia solo deja
  el costo real en el kardex y en el producto.

## Alcance
- **BD:** migración nueva (forward-only).
  - El CHECK de `purchases.status` admite `partially_received`.
  - Columnas nuevas en `purchases`: `shortage_note` y `closed_short boolean`.
  - Columna nueva en `purchase_items`: `received_qty numeric not null default 0`.
  - Tabla `purchase_invoices` (cabecera de cada factura) y tabla `purchase_receipt_lines` (cada
    línea guardada: factura, ítem, cantidad, costo sin IVA, tasa de IVA, movimiento de kardex,
    `voided_at`).
  - Bucket privado `purchase-invoices`.
  - Valores nuevos en el CHECK de `activity_log`.
  - `supplier_balances` aplica R3.
- **RPC:**
  - `create_purchase_invoice`: crea la cabecera de la factura.
  - `receive_purchase_line`: entra el stock con `register_movement`, suma `received_qty` y pasa la
    orden a parcial o recibida, todo atómico.
  - `void_purchase_receipt_line`: anula una línea (R6).
  - `close_purchase_short`: cierra la orden con faltantes (R4).
  - `receive_purchase` (recibir todo) se mantiene para las órdenes sin recepción parcial y sus
    pgTAP no cambian.
  - `cancel_purchase` y `update_purchase` rechazan las órdenes con algo recibido.
- **UI:** página `/compras/ordenes/[id]/recibir`.
  1. Factura: datos y archivo.
  2. Líneas: foto, producto, pedida, recibida, pendiente, cantidad, costo sin IVA, IVA y botón
     "Guardar línea".
  3. Al final: "Queda pendiente" o "Cerrar con faltantes".

  Además: en las listas de compras, el estado *Recibida parcial* con lo que falta; en el detalle
  de la orden, sus facturas con "Ver archivo".
- Textos es/en/fr.

## NO-alcance (explícito)
- Precio de venta e historial de precios del proveedor (S28-02).
- PEPS (pendiente de la contadora).
- Retenciones (retefuente, ReteIVA, ReteICA).
- Una factura que cubre varias órdenes.
- Leer automáticamente el XML de la factura electrónica.
- Devolución de mercancía al proveedor (nota crédito).

## Criterios de aceptación
1. **Dado** una orden aprobada de 10 A y 5 B **cuando** se guarda la factura FE-123 y la línea A
   con 6 unidades a un costo distinto **entonces** el kardex de la bodega elegida suma 6 A a ese
   costo sin IVA, el costo promedio de A se recalcula, la orden queda *Recibida parcial* con
   "A: 4 pendientes · B: 5 pendientes" y cancelarla o editarla se rechaza.
2. **Dado** esa orden parcial **cuando** se elige "Queda pendiente" y otro día se recibe el resto
   con la factura FE-130 **entonces** la orden queda *Recibida*, tiene dos facturas y la deuda con
   el proveedor es la suma de los totales de las dos facturas.
3. **Dado** una orden parcial **cuando** se elige "Cerrar con faltantes" **entonces** la orden
   queda *Recibida* con los faltantes y la nota visibles, y ya no admite más líneas.
4. **Dado** una línea guardada por error **cuando** el dueño la anula **entonces** sale del kardex
   al mismo costo, la cantidad vuelve a pendiente y el costo promedio se recalcula. Un miembro no
   ve el botón y la RPC lo rechaza. Recibir más que lo pendiente, un número de factura repetido
   para ese proveedor o datos de otra empresa también se rechazan.
5. **Dado** un celular de 375px **cuando** se recibe una orden **entonces** cada línea se ve como
   tarjeta, sin scroll horizontal, y "Guardar línea" queda a mano. Un miembro no ve costos ni
   totales de la factura.

## Modelo de datos y migraciones
```sql
alter table purchases drop constraint purchases_status_check, add constraint ... check (status in
  ('draft','ordered','partially_received','received','cancelled'));
alter table purchases add column closed_short boolean not null default false, add column shortage_note text;
alter table purchase_items add column received_qty numeric(14,3) not null default 0
  check (received_qty >= 0 and received_qty <= qty);
create table purchase_invoices (id uuid pk, tenant_id uuid not null, purchase_id uuid not null,
  supplier_id uuid not null, number text not null, issued_on date not null, due_on date, cufe text,
  subtotal numeric(14,2) not null, tax numeric(14,2) not null, total numeric(14,2) not null,
  warehouse_id uuid not null, file_path text, created_by uuid, created_at timestamptz default now(),
  unique (tenant_id, supplier_id, number));
create table purchase_receipt_lines (id uuid pk, tenant_id uuid not null, invoice_id uuid not null,
  purchase_item_id uuid not null, product_id uuid not null, qty numeric(14,3) not null check (qty > 0),
  unit_cost numeric(14,2) not null check (unit_cost >= 0), tax_rate numeric(5,2) not null,
  movement_id uuid not null, voided_at timestamptz, voided_by uuid, created_by uuid, created_at timestamptz default now());
```

## Políticas RLS requeridas
- `purchase_invoices` y `purchase_receipt_lines`: RLS activada y solo SELECT por tenant
  (`tenant_id in user_tenant_ids()`). La escritura va solo por RPC. Las columnas de costo y valor
  no se le dan a `member`: van por grant columnar, igual que `products`.
- Bucket `purchase-invoices`: leer y subir solo dentro de la carpeta `<tenant_id>/` del propio
  tenant.

## Funciones RPC e invariantes
- `receive_purchase_line(p_invoice_id, p_purchase_item_id, p_qty, p_unit_cost, p_tax_rate)`:
  - la orden está en `ordered` o `partially_received` y es del tenant;
  - `received_qty + p_qty <= qty`;
  - si quien llama es `member`, `p_unit_cost` y `p_tax_rate` se ignoran y se usan los de la orden;
  - kardex y `received_qty` se escriben en una sola transacción;
  - el estado pasa a `received` cuando todo quedó recibido.
- `void_purchase_receipt_line(p_line_id)`:
  - solo owner o admin;
  - la línea no está anulada;
  - hay stock en la bodega;
  - hace la salida al mismo costo, resta `received_qty` y la orden vuelve a `partially_received`
    si corresponde.
- `close_purchase_short(p_purchase_id, p_note)`: solo para órdenes en `partially_received`.
- `create_purchase_invoice(...)`:
  - la orden está en `ordered` o `partially_received`;
  - el número no está repetido para ese proveedor;
  - la bodega es del tenant;
  - los totales son mayores o iguales a 0 y total = subtotal + IVA.

## Casos borde
- El mismo producto aparece dos veces en la orden: se recibe por `purchase_item_id`, no por
  producto.
- Costo 0 (muestra gratis): se permite y el promedio baja.
- Archivo que falla al subir: la factura no se guarda y se muestra un error claro.
- Orden recibida antes de esta historia: no tiene facturas y sigue como hoy.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Zod en cada server action, con columnas explícitas y errores mapeados.
- Archivo validado por tipo y tamaño, guardado en una ruta que arma el servidor y leído con URL
  firmada de corta duración.
- El costo nunca llega a `member`, ni en la RPC ni en los selects (R2).

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2, 3 | pgTAP | supabase/tests/S28-01-recepcion-parcial.sql | parcial, completa, cierre con faltantes, kardex, costo promedio, deuda |
| 4 | pgTAP | supabase/tests/S28-01-recepcion-parcial.sql | anular, sobre-recepción, factura repetida, member, otro tenant |
| 1–4 | pgTAP | supabase/tests/S28-01-aislamiento.sql | RLS de las dos tablas nuevas |
| 1–4 | Vitest | src/actions/purchase-receipts.test.ts, src/lib/validation/purchase-receipts.test.ts | Zod, mapeo de errores, archivo |
| 5 | Vitest + manual | src/app/(app)/compras/ordenes/[id]/recibir/*.test.tsx | member sin costos; 375px |

## Historial
- 2026-10-08 · creada (draft) a partir del proceso descrito por el humano.
- 2026-10-08 · approved por el humano (spec y supuestos R1–R7).
- 2026-10-08 · implemented. Ajustes al implementar:
  - R2: el miembro también escribe los totales de la factura que tiene en la mano, pero después
    no los ve (RLS de `purchase_invoices` y `purchase_receipt_lines` solo para dueño/admin).
  - La deuda va en `purchases.invoiced_total`, que se actualiza al crear cada factura.
  - `refresh_purchase_reception` recalcula el estado (ordered / partially_received / received).
  - El botón viejo "Recibir" de la lista (que recibía todo sin factura) se reemplazó por la página
    nueva. La RPC `receive_purchase` sigue igual y además marca `received_qty`.
  - Si se anulan todas las líneas, la orden vuelve a `ordered`.
  - pgTAP 39/39 + aislamiento 6/6, corridos solo en PGlite.
