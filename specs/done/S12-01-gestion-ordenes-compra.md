---
id: S12-01
titulo: Recibir, cancelar y editar órdenes de compra
estado: implemented
depende_de: [S3-03, S3-04]
---

# S12-01 — Recibir, cancelar y editar órdenes de compra

## Contexto y valor

Las RPCs `receive_purchase`, `cancel_purchase` y `update_purchase` existen y están testeadas en
pgTAP desde S3-03/S3-04, pero no tienen Server Action ni UI. Hoy `/compras/ordenes` solo permite
crear y marcar como ordenada: una orden que llega físicamente no puede registrarse, el stock nunca
sube y las cuentas por pagar quedan desconectadas de la realidad operativa. Épica E12
("Desbloquear la operación", bugs reportados por usuarios reales).

## Alcance

- Detalle de ítems de una orden, expandible inline en la fila.
- Acción "Recibir" (bodega + `receive_purchase`), disponible para cualquier miembro.
- Acción "Cancelar" (`cancel_purchase`), solo owner/admin.
- Acción "Editar" (`update_purchase`), solo owner/admin, reusando `PurchaseForm` en modo edición.
- Mapeo de los nuevos errores de negocio a mensajes en español.

## NO-alcance (explícito)

- E2E nuevo de compras (no existe hoy `e2e/*purchases*`; se anota como historia futura en BACKLOG).
- Rediseño visual del módulo de compras.
- Migraciones o cambios de esquema (toda la capa de datos ya existe).

## Criterios de aceptación

1. **Dado** una orden con ítems **cuando** el usuario expande su fila **entonces** ve producto,
   cantidad, costo unitario, IVA y subtotal de cada ítem, solo lectura.
2. **Dado** una orden en `ordered` **cuando** cualquier miembro elige una bodega y confirma
   "Recibir" **entonces** se invoca `receive_purchase`, la orden pasa a `Recibida` y el stock de
   cada ítem sube (verificable en `/inventario`).
3. **Dado** una orden en `draft` u `ordered` **cuando** un owner/admin confirma "Cancelar"
   **entonces** se invoca `cancel_purchase` y la orden pasa a `Cancelada`; un `member` no ve el
   botón.
4. **Dado** una orden en `draft` u `ordered` **cuando** un owner/admin la edita (proveedor, nota o
   ítems) y guarda **entonces** se invoca `update_purchase` y los totales se recalculan en BD.
5. **Dado** un error de negocio de cualquiera de las 3 RPCs (`warehouse_invalid`,
   `purchase_not_ordered`, `purchase_not_cancellable`, `purchase_not_updatable`,
   `permission_denied`) **cuando** ocurre **entonces** el usuario ve un mensaje en español, nunca
   el error crudo de Postgres.
6. **Dado** un viewport de 375px **cuando** se navega `/compras/ordenes` con filas expandidas
   **entonces** no hay scroll horizontal del body (la tabla mantiene su `overflow-x-auto`, la celda
   de acciones envuelve con `flex-wrap`).

## Modelo de datos y migraciones

N/A — sin cambios de esquema. Se reutilizan `purchases`, `purchase_items` (RLS ya solo SELECT por
tenant, `20260720090000_purchases.sql`).

## Políticas RLS requeridas

N/A — sin cambios. La autorización de rol para cancelar/editar la valida la RPC (`security
definer`, no una política de tabla — mismo patrón documentado en la migración original).

## Funciones RPC e invariantes

Ya existentes, sin cambios:
- `receive_purchase(p_purchase_id uuid, p_warehouse_id uuid)` — `not_authenticated`,
  `purchase_not_found`, `permission_denied` (pertenencia al tenant, no rol),
  `warehouse_invalid`, `purchase_not_ordered`.
- `cancel_purchase(p_purchase_id uuid)` — `purchase_not_found`, `permission_denied` (admin),
  `purchase_not_cancellable`.
- `update_purchase(p_purchase_id uuid, p_supplier_id uuid, p_items jsonb, p_note text)` —
  `permission_denied` (admin), `purchase_not_updatable`, `items_required`, `supplier_invalid`.

## Casos borde

- Orden sin ítems visibles: no aplica (create_purchase exige `items_required`).
- Un `member` intenta cancelar/editar vía URL directa: el botón no se renderiza; si de algún modo
  se invoca la action, la RPC devuelve `permission_denied` y se muestra el mensaje mapeado (defensa
  en profundidad, la RPC es la autoridad real).
- Recibir dos veces la misma orden: la RPC rechaza con `purchase_not_ordered` tras la primera
  recepción (ya pasó a `received`).
- `markPurchaseOrdered` deja de tragar errores en silencio (bug de UX preexistente, corregido de
  paso porque su fila se reescribe en esta historia).

## Consideraciones de seguridad (docs/arch/seguridad.md)

- Boundaries nuevos (`receivePurchase`, `cancelPurchase`, `updatePurchase`) validan sus argumentos
  con Zod antes de llamar la RPC — nunca pasan FormData crudo.
- Errores de Postgres nunca llegan al cliente tal cual: se loguean con `console.error` y se
  traducen con `mapPurchaseError`.
- La autorización de rol es responsabilidad de la RPC (`security definer`); la UI solo oculta
  botones por comodidad, no como control de seguridad real.

## Plan de tests (qué test cubre qué criterio)

| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 2 | Vitest | src/actions/purchases.test.ts | `receivePurchase` llama `receive_purchase` con los params correctos y revalida |
| 5 | Vitest | src/actions/purchases.test.ts | errores `warehouse_invalid`/`purchase_not_ordered`/`purchase_not_cancellable` mapean a mensaje en español |
| 3 | Vitest | src/actions/purchases.test.ts | `cancelPurchase` llama `cancel_purchase` |
| 4 | Vitest | src/actions/purchases.test.ts | `updatePurchase` valida ítems con Zod antes de invocar la RPC; caso feliz llama `update_purchase` |
| 1, 3, 4, 6 | Manual + Playwright responsive | e2e/responsive.spec.ts (no-regresión) | sin scroll horizontal a 375px en `/compras/ordenes` |

Los criterios de negocio de las RPCs en sí (invariantes, atomicidad) ya están cubiertos por
`supabase/tests/S3-03-receive-purchase.sql` y `S3-04-cancelacion-compra.sql` — no se duplican aquí.

## Historial
- 2026-08-15 · creada (draft), aprobada por el humano vía plan mode (approved).
- 2026-08-15 · implementada (TDD: `src/actions/purchases.test.ts` rojo 7/7 antes de implementar,
  verde después). Verificación real: `npm run lint` ✓, `npx tsc --noEmit` ✓, `npm test` 159/159 ✓,
  `npm run build` ✓, `supabase test db` 341/341 pgTAP ✓ (tras `supabase db reset` — un fallo previo
  de `S11-01-limite-un-owner.sql` resultó ser estado residual de la BD local, no una regresión de
  esta historia). Verificación manual con Supabase local + seed real (`demo@miel.test`) vía
  Playwright: crear orden → ordenar → expandir ítems → Recibir en bodega (stock verificado con
  `stock_movements`, sube 1.000 unidades del ítem recibido) → Editar (cantidad 5→9, total
  recalculado en BD a 1.071,00) → Cancelar (estado → Cancelada, acciones desaparecen).
  `npx playwright test --project=desktop` (smoke, landing, core-flow) 6/6 ✓; responsive móvil
  (375px) con fila expandida: `scrollWidth == clientWidth == 375` ✓, capturas revisadas. `1 Issue`
  visible en el overlay de Next dev durante una captura, sin error en consola/`pageerror`/build —
  mismo hallazgo no reproducible ya anotado en S10-02, se deja constancia por honestidad.
- 2026-08-15 · movida a `specs/done/`.
