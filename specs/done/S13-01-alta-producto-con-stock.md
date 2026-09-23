---
id: S13-01
titulo: Un solo camino para dar de alta un producto con su stock inicial
estado: implemented
depende_de: [S2-01, S2-02]
---

# S13-01 — Un solo camino para dar de alta un producto con su stock inicial

## Contexto y valor
El dueño se confunde entre "+ Ingresar stock manual" (`/inventario`) y "Crear producto"
(`/inventario/productos`): parecen alternativas del mismo trámite y ninguna completa el trabajo
real ("tengo este producto y tengo N unidades"). Existen 3 formularios casi idénticos
(`inventario/manual-movement-form.tsx`, `kardex/[productId]/movement-form.tsx` —duplicado literal
del anterior—, `productos/product-form.tsx`). Esta historia unifica alta de producto + stock
inicial en una sola operación atómica y deja un único componente para "registrar movimiento sobre
un producto existente".

## Alcance
- RPC `create_product_with_stock`: crea el producto y, si se indica bodega+cantidad, el
  movimiento `in` inicial, en una sola transacción.
- `productos/product-form.tsx`: bloque opcional "Stock inicial" (bodega + cantidad) visible solo
  en modo creación.
- Un único componente de "registrar movimiento de stock" (fusiona `manual-movement-form.tsx` y
  `kardex/[productId]/movement-form.tsx`), reutilizado en `/inventario` y en el kardex.
- `/inventario` conserva el acceso a registrar movimiento (renombrado), para poder reponer stock
  de un producto que se creó sin stock inicial.

## NO-alcance (explícito)
- Exponer `out`/`adjust` en la UI (S13-03).
- Mover el formulario de edición fuera del `<tr>` (S13-02).
- Ruta nueva `/inventario/productos/nuevo` (se descartó con el humano: el bloque va en el
  formulario existente).
- Campo de costo unitario propio para el stock inicial (se usa el campo `Costo` del producto).

## Criterios de aceptación
1. **Dado** un owner/admin en `/inventario/productos`, **cuando** completa la ficha del producto y
   elige bodega + cantidad en "Stock inicial", **entonces** se crean el producto y un movimiento
   `kind='in'` con `unit_cost` = costo del producto, en una sola operación.
2. **Dado** el mismo formulario **cuando** deja "Stock inicial" vacío **entonces** se crea solo el
   producto, sin movimiento.
3. **Dado** que el movimiento inicial falla (bodega de otro tenant, cantidad inválida)
   **entonces** no queda producto creado (atomicidad) y la UI muestra un error legible.
4. **Dado** un `member` **entonces** la RPC rechaza la creación (RLS de `products`), igual que hoy.
5. **Dado** viewport 375px **entonces** el formulario, incluido el bloque de stock inicial, se
   apila en una columna sin scroll horizontal (ADR-025).

## Modelo de datos y migraciones
Sin tablas nuevas ni columnas nuevas. Una función nueva (ver abajo). Migración
`supabase/migrations/<ts>_alta-producto-con-stock.sql`.

## Políticas RLS requeridas
Ninguna nueva. La función corre `security invoker`: el `insert` en `products` queda sujeto a la
política existente `products_admin_write` (`20260720064734_products.sql`); el `register_movement`
interno reusa sus propias validaciones de tenant/rol.

## Funciones RPC e invariantes
`create_product_with_stock(p_tenant_id, p_sku, p_name, p_description, p_unit, p_kind, p_cost,
p_price, p_tax_rate, p_min_stock, p_warehouse_id default null, p_qty default null) returns uuid`
`language plpgsql security invoker set search_path = public`.

- Invariante 1: inserción de producto y movimiento inicial son atómicas (todo o nada).
- Invariante 2: `p_qty > 0` sin `p_warehouse_id` → excepción `warehouse_required` (P0001).
- Invariante 3: sin stock inicial (`p_warehouse_id is null` o `p_qty` nulo/0) → solo se crea el
  producto, ningún movimiento.
- Delega en `register_movement` toda validación de bodega/tenant/signo de cantidad — no se
  duplica lógica.

**Excepción documentada a la regla 2 de `docs/arch/patron-rpc.md`** ("la función NO recibe
`tenant_id` del cliente"): en una *creación* no existe registro previo del cual derivarlo, y un
usuario con varias memberships necesita indicar el tenant activo explícito (mismo problema que
corrigió S12-04 en `open_cash_session` — adivinar es el bug). Se recibe `p_tenant_id` explícito
(resuelto en el servidor vía `getActiveTenant()`, nunca tomado a ciegas del cliente) y la política
RLS de `products` es quien valida la membership real. Registrado en **ADR-030**.

## Casos borde
- SKU duplicado (`unique(tenant_id, sku)`) → error `23505`, mismo mapeo que hoy
  (`mapProductError`), sin movimiento creado.
- `p_qty` negativo o cero con bodega elegida → no crea movimiento (criterio 2), no es error.
- Producto `kind` distinto de los 3 válidos → rechazado por el `check` existente de la tabla.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Boundary: `createProduct` valida con Zod (`productWithStockSchema`) antes de llamar la RPC;
  inserts con columnas explícitas dentro de la función (no spread del input del cliente).
- Errores internos (código Postgres) nunca llegan al cliente tal cual — `mapProductError` sigue
  devolviendo mensaje genérico salvo los casos ya mapeados.
- `p_tenant_id` no llega en bruto del `FormData`: se resuelve en el servidor con
  `getActiveTenant()`, igual que S12-04.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S13-01-alta-producto-con-stock.sql | alta con stock crea producto + 1 movimiento `in` con qty/unit_cost correctos |
| 2 | pgTAP | supabase/tests/S13-01-alta-producto-con-stock.sql | alta sin stock crea producto, 0 movimientos |
| 3 | pgTAP | supabase/tests/S13-01-alta-producto-con-stock.sql | bodega de otro tenant → throws, producto no queda creado (atomicidad) |
| 4 | pgTAP | supabase/tests/S13-01-alta-producto-con-stock.sql | member → rechazo por RLS |
| 1,2,3 | Vitest | src/lib/validation/products.test.ts | `productWithStockSchema`: stock opcional, `initial_qty>0` exige `warehouse_id` |
| 3 | Vitest | src/actions/products.test.ts | `createProduct` mapea `warehouse_required`/error de RPC a mensaje legible |
| 5 | Playwright ad-hoc | manual, no persiste en `e2e/` | 375px sin scroll horizontal en `/inventario/productos` |

## Historial
- 2026-08-15 · creada (draft) y aprobada junto con el plan de implementación (ExitPlanMode) →
  `approved`.
- 2026-08-15 · implementada: RPC `create_product_with_stock` (ADR-030), `productWithStockSchema`,
  `createProduct` migrado a la RPC, bloque "Stock inicial" en `product-form.tsx`, fusión de
  `manual-movement-form.tsx`+`kardex/[productId]/movement-form.tsx` en `stock-movement-form.tsx`.
  `supabase test db` 362/362, `npm test` 184/184, lint/tsc/build limpios, Playwright 9/9 (1 skip
  preexistente), verificación E2E manual real (Playwright ad-hoc, script borrado al cerrar) de
  los 5 criterios → `implemented`.
