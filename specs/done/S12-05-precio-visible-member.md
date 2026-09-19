---
id: S12-05
titulo: El POS revienta con 42501 — precio de venta no visible para member
estado: implemented            # draft → approved → implemented
depende_de: [S2-02, S5-10]
---

# S12-05 — El POS revienta con 42501 — precio de venta no visible para member

## Contexto y valor
`/ventas/pos` lanza un Runtime Error con `{code: "42501"}` (`insufficient_privilege`). Causa
confirmada empíricamente (psql local): `src/app/(app)/ventas/pos/page.tsx` consulta la tabla base
`products` pidiendo `price`/`tax_rate`, columnas que el GRANT de S2-02 excluye deliberadamente de
`authenticated` (solo se leen vía `products_catalog`). Cambiar la página a la vista no basta: la
vista enmascara `price`/`tax_rate` a `null` para `member`, pero `permisos-roles.md` autoriza a
`member` a operar el POS — un cajero no puede cobrar sin ver el precio. El precio de venta al
público no es margen; se corrige el modelo (ADR-029), no solo el síntoma.

## Alcance
- `products_catalog` deja de enmascarar `price`/`tax_rate`; solo `cost` sigue oculto a `member`.
- `/ventas/pos` pasa a leer `products_catalog` en vez de la tabla base `products`.
- ADR-029 + actualización de `docs/arch/permisos-roles.md`.

## NO-alcance (explícito)
- No se amplía el GRANT columnar de la tabla base `products` (se mantiene sin `cost`/`price`/
  `tax_rate`; solo la vista cambia qué enmascara).
- No se toca `purchase_items.unit_cost` (deuda preexistente anotada en BACKLOG, ajena a esta
  historia — toca `compras/`).
- No se toca ningún otro módulo (`compras/ordenes`, `inventario/productos`, `kardex`, etc.) más
  allá de que dejan de recibir `price`/`tax_rate` en `null` para `member` (efecto del cambio de
  vista, sin tocar su código).

## Criterios de aceptación
1. **Dado** un usuario con caja abierta **cuando** entra a `/ventas/pos` **entonces** la página
   carga sin error 42501 y el selector de productos prellena precio e IVA.
2. **Dado** un usuario `member` **cuando** consulta `products_catalog` **entonces** ve `price`/
   `tax_rate` reales y `cost` como `null`.
3. **Dado** un usuario `member` **cuando** intenta leer `price`/`cost` directo de la tabla base
   `products` **entonces** sigue fallando con `42501` (el GRANT de la tabla no cambia).

## Modelo de datos y migraciones
Sin tablas/columnas nuevas. `create or replace view public.products_catalog`: el `case` de
enmascarado queda solo sobre `cost`; `price`/`tax_rate` se leen en claro (`::numeric` explícito
para preservar el typmod de la vista y permitir `create or replace` sin `drop`).

## Políticas RLS requeridas
Sin cambios en políticas de tabla. El aislamiento por tenant de la vista (`where tenant_id in
(select user_tenant_ids())`) se conserva íntegro — necesario porque el dueño de la vista
(`postgres`) tiene `rolbypassrls`, así que `FORCE ROW LEVEL SECURITY` no basta.

## Funciones RPC e invariantes
N/A — no hay RPC nueva ni modificada.

## Casos borde
- `member` sin membership en el tenant del producto: sigue sin ver la fila (el `where` de la
  vista no cambia).
- Owner/admin: sin cambio de comportamiento (ya veían `price`/`tax_rate`/`cost` reales).

## Consideraciones de seguridad (docs/arch/seguridad.md)
Exponer `price`/`tax_rate` a `member` no expone margen: `cost` sigue enmascarado en la vista y
sigue sin GRANT en la tabla base — el precio de venta al público no permite inferir costo de
compra/producción. Cambio de superficie mínimo (solo la vista), sin tocar el GRANT de la tabla
base ni RLS.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 2 | pgTAP | supabase/tests/S2-02-productos.sql | member ve `price`/`tax_rate` reales y `cost` null en la vista (invierte + amplía la aserción original) |
| 3 | pgTAP | supabase/tests/S2-02-productos.sql | member sigue sin poder leer `cost` directo de la tabla base (ya existente, sin cambios) |
| 1, 2, 3 | pgTAP | supabase/tests/S12-05-precio-visible-member.sql | fixture dedicado: member ve price/tax_rate reales + cost null vía la vista; aislamiento por tenant conservado; lectura directa de `price` en la tabla base sigue en 42501 |

## Historial
- 2026-08-15 · creada (draft), aprobada por el humano vía plan mode en la misma sesión que
  diagnosticó el 42501 (approved)
- 2026-08-15 · implementada (implemented). Causa raíz reproducida en psql local antes de
  escribir el plan (`set role authenticated; select price from products` → 42501). TDD real:
  `S2-02-productos.sql` invertido (member ya no ve `price`/`tax_rate` null) + ampliado (nueva
  aserción `tax_rate`), y `S12-05-precio-visible-member.sql` nuevo (5 aserciones) — ambos rojo
  confirmado (`have: null, want: 250.00` / función con el enmascarado viejo) antes de la
  migración, verde después. Migración `20260815130000_precio-visible-member.sql`:
  `create or replace view products_catalog` con el `case` de enmascarado solo sobre `cost`;
  `price::numeric`/`tax_rate::numeric` explícitos porque sin el cast `create or replace` falla
  (`cannot change data type of view column "price"` — el `case ... else null` original degrada
  el typmod a -1, exponer la columna pelada la sube a `numeric(14,2)`). `ventas/pos/page.tsx`
  pasa de `products` a `products_catalog`, con normalización de nullables en servidor (mismo
  patrón de `ventas/pedidos/page.tsx`). `database.types.ts` regenerado sin diff (el cast
  preserva la forma del tipo). ADR-029 en `docs/DECISIONS.md`; `permisos-roles.md` actualizado.
  Verificado: `npm run lint` ✓, `npx tsc --noEmit` ✓, `npm test` 175/175 ✓, `npm run build` ✓,
  `supabase db reset` sin error, `supabase test db` **352/352 pgTAP** ✓. End-to-end real con
  Supabase local + `npm run seed` + Playwright ad-hoc (script temporal, borrado al cerrar):
  login `demo@miel.test` → abrir caja → `/ventas/pos` carga sin overlay de Runtime Error ni
  errores de consola (antes reventaba con 42501); seleccionar "Miel Premium 250ml" prellena
  `unit_price: "15000"`, `tax_rate: "19"` (valores reales, no `"0"`/`"null"`). El comportamiento
  específico de `member` (ve `price`/`tax_rate`, no ve `cost`) se verificó vía pgTAP —misma
  autoridad de RLS que aplica en producción— y no se fabricó un segundo usuario invitado en
  Playwright para no duplicar cobertura ya real a nivel de BD (regla #9: la verificación pgTAP
  ejecuta contra el motor real, no es una simulación).
  Sin cambios en layout/responsive (misma página, mismo grid) → checklist responsive N/A.
