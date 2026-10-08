---
id: S28-02
titulo: Al recibir con otro costo, el precio de venta se ajusta y queda el historial del proveedor
estado: implemented
depende_de: [S28-01]
---

# S28-02 — Precio de venta al recibir e historial de precios del proveedor

## Contexto y valor
Cuando el proveedor sube o baja el precio, hoy el dueño tiene que ir aparte a cada producto a
corregir el precio de venta, y no hay forma de ver cómo ha cambiado lo que le cobra cada
proveedor. Con esta historia, la misma línea de la recepción (S28-01) ajusta el precio de venta
del producto, y con eso el catálogo y la tienda, y deja a la vista el historial de precios por
proveedor y producto.

## Supuestos (decididos con el humano el 2026-10-08, confirmar al aprobar)
- **P1 · Mismo % de ganancia (decidido por el humano):** cuando el costo promedio del producto
  cambia al guardar una línea, el precio de venta se recalcula con la fórmula
  `precio nuevo = precio anterior × costo nuevo / costo anterior`, redondeado al peso. Así se
  conserva el % sobre el costo de `PriceFields`.
  - Antes de guardar, la línea muestra "Precio de venta: $X → $Y", y el dueño o un administrador
    puede escribir otro valor.
  - Si el costo anterior era 0 o no existía, el precio no se toca y se avisa "Revisa el precio de
    venta".
- **P2 · El descuento del catálogo** (`discount_percent`) no cambia; se aplica sobre el precio
  nuevo.
- **P3 · Historial sin tabla nueva:** las líneas de recepción de S28-01 ya guardan proveedor,
  producto, costo real, fecha y factura. El historial es una vista sobre ellas, sin las líneas
  anuladas.
- **P4 · Dónde se ve el historial:**
  - en la ficha del producto: "Precios de proveedores", con fecha, proveedor, factura, costo sin
    IVA y la variación contra la compra anterior;
  - en la ficha del proveedor: lo mismo filtrado por ese proveedor.

  Solo lo ven el dueño y los administradores, porque es costo (ADR-029).
- **P5 · Anular la línea (R6 de S28-01) no devuelve el precio de venta:** el cambio de precio es
  una decisión aparte y se corrige a mano. La línea anulada sale del historial.
- **P6 · Si recibe un miembro:** la línea entra al costo de la orden (R2 de S28-01). Si con eso el
  costo promedio cambia, el precio de venta también se ajusta con P1; el miembro no ve esa
  información.

## Alcance
- **BD:** migración nueva.
  - `receive_purchase_line` gana `p_sale_price numeric default null`. En la misma transacción
    calcula P1 (o usa el precio dado si quien llama es owner o admin) y actualiza
    `products.price`. Se agrega un `create or replace` en una migración nueva.
  - Vista `supplier_price_history` con `security_invoker`.
- **UI:**
  - en cada línea de recepción, el aviso "Precio de venta: $X → $Y" y el campo para cambiarlo;
  - las secciones del historial (P4).
- Textos es/en/fr.

## NO-alcance (explícito)
- PEPS.
- Listas de precios por cliente.
- Precio distinto por bodega.
- Avisar a los clientes de la tienda que el precio cambió.
- Gráficos del historial.

## Criterios de aceptación
1. **Dado** A con costo $1.000, precio $1.500 y 10 en stock **cuando** se reciben 10 a $1.200
   **entonces** el costo queda en $1.100, el precio queda en $1.650 (mismo 50 %) y el catálogo y
   la tienda muestran $1.650 (con su descuento, si tiene).
2. **Dado** esa línea **cuando** el dueño escribe $1.700 antes de guardar **entonces** el precio
   queda en $1.700. Si el costo anterior era 0, el precio no cambia y aparece el aviso.
3. **Dado** dos facturas del proveedor X para A (a $1.000 y a $1.200) y una del proveedor Y
   **cuando** el dueño abre la ficha de A **entonces** ve las tres con su fecha, factura, costo y
   variación (+20 %). En la ficha de X solo ve las de X. Un miembro no ve ninguna de las dos
   secciones.
4. **Dado** una línea anulada **entonces** sale del historial y el precio de venta no cambia.
5. **Dado** un celular de 375px **entonces** el historial y el aviso de precio se ven sin scroll
   horizontal.

## Modelo de datos y migraciones
```sql
create view supplier_price_history with (security_invoker = true) as
select l.tenant_id, i.supplier_id, l.product_id, i.issued_on, i.number, l.unit_cost, l.created_at
from purchase_receipt_lines l join purchase_invoices i on i.id = l.invoice_id
where l.voided_at is null;
-- variación: lag(unit_cost) over (partition by supplier_id, product_id order by issued_on, created_at)
```

## Políticas RLS requeridas
La vista hereda la RLS de las tablas de S28-01 (`security_invoker`). No da grant a `member` sobre
las columnas de costo.

## Funciones RPC e invariantes
- `receive_purchase_line(..., p_sale_price)`:
  - stock, costo y precio se escriben en una sola transacción;
  - `p_sale_price` se ignora si quien llama es `member`;
  - `p_sale_price` tiene que ser mayor o igual a 0;
  - el redondeo es al peso.

## Casos borde
- Costo promedio sin cambios (mismo costo): el precio no se toca.
- Stock negativo o en cero antes de recibir: el costo promedio es el de la entrada y P1 usa el
  costo anterior de la ficha.
- Producto sin precio (materia prima): no se toca.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- `p_sale_price` se valida con Zod en el server action y otra vez en la RPC.
- La vista no expone costos a `member`.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2, 4 | pgTAP | supabase/tests/S28-02-precio-al-recibir.sql | fórmula, redondeo, precio manual, costo 0, anulación |
| 3 | pgTAP | supabase/tests/S28-02-precio-al-recibir.sql | vista por proveedor, member sin acceso, aislamiento |
| 1, 2 | Vitest | src/lib/pricing.test.ts | cálculo del precio propuesto en la UI |
| 5 | manual | — | 375px |

## Historial
- 2026-10-08 · creada (draft) a partir del proceso descrito por el humano.
- 2026-10-08 · approved por el humano (spec y supuestos P1–P6).
- 2026-10-08 · implemented. Ajustes al implementar:
  - En `receive_purchase_line`, `p_unit_cost` y `p_tax_rate` pasan a tener default null (el
    miembro no los manda).
  - La vista incluye `product_name` y `prev_cost`.
  - La "ficha del producto" es la página Kardex (`/inventario/kardex/[id]`) y la del proveedor es
    "Productos del proveedor".
  - La UI calcula el precio propuesto con `receiptPricePreview` (`src/lib/pricing.ts`).
  - pgTAP 13/13, corridos solo en PGlite.
