---
id: S12-02
titulo: Hora de Colombia consistente en toda la app
estado: implemented            # draft → approved → implemented
depende_de: []
---

# S12-02 — Hora de Colombia consistente en toda la app

## Contexto y valor
El negocio opera en Colombia. Hoy las fechas se formatean con `toLocaleDateString`/
`toLocaleString`/`Intl.DateTimeFormat` sin `timeZone` explícito (~20 sitios), algunos incluso con
locale `undefined` o `"es-ES"`. En Server Components esto usa el TZ del proceso Node (UTC en
Vercel) — una compra recibida a las 7pm Bogotá puede mostrarse con fecha del día siguiente. El
selector `datetime-local` de gastos agrava esto: guarda/lee la hora como si el reloj del usuario
fuera UTC, y además la validación Zod actual (`z.string().datetime()`) rechaza el valor crudo del
input (`"2026-08-15T14:30"`, sin sufijo `Z`) — confirmado con un `safeParse` real, node
`false`/`true` — así que hoy el campo "Fecha de pago" nunca se guarda tal cual se escribe.

## Alcance
- `src/lib/format.ts` nuevo: `formatDate`, `formatDateTime`, `formatMoney` (todos fijan
  `timeZone: "America/Bogota"` / locale `"es-CO"` donde aplica) + `toDatetimeLocalValue` /
  `fromDatetimeLocalValue` (conversión ida y vuelta entre un `datetime-local` y un ISO UTC,
  interpretando el valor del input como hora de Bogotá — offset fijo `-05:00`, sin DST).
- Reemplaza los usos ad-hoc de `toLocaleString`/`toLocaleDateString`/`Intl.DateTimeFormat` para
  fechas y montos en (lista cerrada, confirmada por grep):
  `compras/cuentas-por-pagar/page.tsx`, `compras/ordenes/purchase-form.tsx`,
  `compras/ordenes/purchase-row.tsx`, `compras/proveedores/[id]/cuenta/page.tsx`,
  `ventas/cuentas-por-cobrar/page.tsx`, `ventas/pedidos/sale-row.tsx`,
  `ventas/pedidos/sale-form.tsx`, `ventas/pos/pos-terminal.tsx`, `ventas/caja/page.tsx`,
  `finanzas/pnl-chart.tsx`, `finanzas/cash-flow-chart.tsx`, `finanzas/expenses-chart.tsx`,
  `ventas/clientes/[id]/page.tsx`, `inventario/page.tsx`, `inventario/productos/product-row.tsx`,
  `inventario/kardex/[productId]/page.tsx`, `gastos/expense-row.tsx`.
- Corrige el bug de `gastos/expense-form.tsx` (`defaultValue` del `datetime-local` usando
  `toISOString()` crudo) y `src/actions/expenses.ts` (el `paid_at` submitted del input se
  convierte a ISO UTC vía `fromDatetimeLocalValue` **antes** de `expenseSchema.safeParse`, para
  que el `z.string().datetime()` deje de rechazarlo).
- Test unitario nuevo `src/lib/format.test.ts` (TDD: rojo antes de crear `format.ts`).

## NO-alcance (explícito)
- `inventario/alertas/page.tsx` e `inventario/kardex/[productId]/page.tsx` (líneas de cantidad,
  `Number(...).toLocaleString()`) y `src/components/ui/chart.tsx` (tooltip genérico shadcn): son
  formateo de números planos, sin fecha ni TZ — fuera de alcance.
- Selector de TZ configurable por tenant/usuario — Colombia es el único mercado del MVP, TZ
  hardcodeado a propósito (igual patrón que `"es-CO"` ya hardcodeado en el resto del repo).
- Unificar el estilo visual de montos (`$1.234,56` vs `$ 1.235` con `style:"currency"`) — se
  preserva el formato visual exacto de cada sitio, `formatMoney` solo centraliza el locale/lógica,
  no cambia opciones por defecto de cada llamador.
- Backfill de datos ya guardados con timestamps incorrectos (dato existente, no hay forma de saber
  qué hora pretendía el usuario) — solo se corrige hacia adelante.

## Criterios de aceptación
1. **Dado** un timestamp UTC que cae después de las 7pm hora Bogotá (p. ej. `2026-08-16T02:00:00Z`
   = 15-ago 9pm Bogotá) **cuando** se formatea con `formatDate`/`formatDateTime`
   **entonces** el día mostrado es el 15 de agosto (Bogotá), no el 16 (UTC).
2. **Dado** el formulario de gastos con `defaultValue` de un `paid_at` guardado
   **cuando** se abre en modo edición **entonces** el `datetime-local` muestra la hora de Bogotá
   correspondiente, no la hora UTC cruda.
3. **Dado** un usuario que escribe una hora en el campo `datetime-local` de gastos y envía el
   formulario **cuando** `createExpense`/`updateExpense` procesan el `FormData`
   **entonces** `expenseSchema.safeParse` acepta el valor (ya no lo rechaza por formato) y el
   `paid_at` guardado en BD corresponde a esa hora interpretada como hora de Bogotá.
4. **Dado** cualquiera de los ~20 sitios de la lista de Alcance **cuando** se audita el archivo
   tras el cambio **entonces** no queda ningún `toLocaleString`/`toLocaleDateString`/
   `Intl.DateTimeFormat` de fecha o dinero sin pasar por `src/lib/format.ts`.
5. **Dado** el helper `formatMoney` **cuando** se le pasa `null`/`undefined`
   **entonces** devuelve `"0,00"` (o el formato de 2 decimales configurado) sin lanzar.

## Modelo de datos y migraciones
N/A — sin cambios de esquema, solo capa de presentación y parseo de un input existente.

## Políticas RLS requeridas
N/A.

## Funciones RPC e invariantes
N/A — no se toca ninguna RPC; `paid_at` ya era una columna de `expenses` insertada directo (sin
RPC) desde antes de esta historia.

## Casos borde
- `paid_at` vacío en el formulario de gastos → sigue cayendo al default `new Date().toISOString()`
  en `toColumns` (comportamiento actual, sin cambios).
- `formatDate`/`formatDateTime` reciben un `Date` en vez de `string` (algunos call sites ya
  construyen `new Date(...)` antes de formatear) → ambas funciones aceptan `string | Date`.
- `toDatetimeLocalValue(null)` / `(undefined)` → `""` (mismo comportamiento que hoy, campo vacío).
- Bogotá no tiene horario de verano (offset fijo `-05:00` todo el año) — el cálculo con offset
  literal en `fromDatetimeLocalValue`/`toDatetimeLocalValue` es correcto sin librería de TZ.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- `fromDatetimeLocalValue` recibe un string de un boundary de servidor (`FormData` de
  `createExpense`/`updateExpense`); se sigue validando con Zod (`z.string().datetime()`) **después**
  de la conversión — el helper no reemplaza la validación, solo normaliza el formato antes de ella.
  Si el string no es un `datetime-local` válido, `new Date(...)` produce `Invalid Date` →
  `.toISOString()` lanza `RangeError`, capturado porque hoy el bloque ya está dentro de un `try`
  implícito de Server Action (Next envuelve el handler); se añade guard explícito
  (`isNaN(date.getTime())` → tratar como ausente) para no depender de eso y devolver el error
  genérico de validación en vez de un 500.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | Vitest | src/lib/format.test.ts | `formatDate`/`formatDateTime` con timestamp UTC post-7pm Bogotá muestran el día correcto |
| 2, 3 | Vitest | src/lib/format.test.ts | `toDatetimeLocalValue`/`fromDatetimeLocalValue` son inversas (round-trip) y ambas interpretan/producen hora Bogotá |
| 3 | Vitest | src/lib/format.test.ts | `fromDatetimeLocalValue("2026-08-15T14:30")` produce un ISO que `z.string().datetime().safeParse` acepta |
| 5 | Vitest | src/lib/format.test.ts | `formatMoney(null)`/`formatMoney(undefined)` no lanzan y devuelven `"0,00"` |
| 4 | manual (grep) | — | `grep -rn "toLocaleString\|toLocaleDateString\|Intl.DateTimeFormat"` en los archivos de Alcance devuelve 0 resultados fuera de `format.ts` |

## Historial
- 2026-08-15 · creada (draft)
- 2026-08-15 · aprobada por el humano sin cambios
- 2026-08-15 · implementada: `src/lib/format.ts` nuevo (TDD, 8/8 verde antes de tocar los ~20
  call sites); reemplazados todos los usos ad-hoc de fecha/dinero en la lista de Alcance
  (confirmado por grep: 0 restantes salvo los 2 casos de cantidad explícitamente fuera de
  alcance). Fix del `datetime-local` de gastos: `toDatetimeLocalValue` en el `defaultValue` del
  form, `fromDatetimeLocalValue` (con guard try/catch) en `createExpense`/`updateExpense` antes
  de `expenseSchema.safeParse`. Verificación real (regla #9): `npm run lint` ✓, `npx tsc --noEmit`
  ✓, `npm test` 167/167 ✓, `npm run build` ✓, `npx playwright test` 9/9 ✓ (1 fixme preexistente).
  Verificación manual end-to-end con Supabase local + `npm run seed`: gasto creado con
  `paid_at` = 15-ago 21:00 (hora Bogotá) se muestra en la tabla como "15 de ago de 2026" (no 16,
  que habría confirmado el bug UTC viejo); sin alerta de validación Zod (el bug de rechazo
  silencioso confirmado antes de implementar, con un `safeParse` real en node, quedó corregido).
