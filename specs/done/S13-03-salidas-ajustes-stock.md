---
id: S13-03
titulo: Salidas y ajustes de stock desde la UI
estado: implemented            # draft → approved → implemented
depende_de: [S2-02]
---

# S13-03 — Salidas y ajustes de stock desde la UI

## Contexto y valor

`stock-movement-form.tsx` hardcodea `<input type="hidden" name="kind" value="in" />`: la UI solo
sabe sumar stock. El dueño no puede registrar una merma, una rotura ni corregir una cantidad mal
digitada — hoy la única forma de que baje el stock es vender o producir. El RPC `register_movement`
y el Zod (`stockMovementSchema`) ya aceptan `out`/`adjust`; falta exponerlo en la UI.

## Alcance

- `stock-movement-form.tsx` gana un selector de tipo de movimiento (Entrada/Salida/Ajuste) con el
  `Select` de shadcn ya usado en el mismo formulario.
- Cantidad reactiva al tipo: entrada/salida exigen positivo; ajuste admite negativo (delta con
  signo) con texto de ayuda.
- Campo "Costo unitario" se oculta cuando el movimiento no fija costo (salida, y ajuste con
  cantidad negativa) — el RPC ignora `p_unit_cost` ahí y congela el promedio ponderado.
- `src/actions/stock.ts`: mensaje de `stock_insufficient` deja de decir "para realizar esta
  salida" (también lo dispara un ajuste negativo).

## NO-alcance (explícito)

- Sin migración, RPC ni política RLS nueva.
- No se muestra el stock actual del producto/bodega dentro del formulario.
- No se toca `kind='transfer'` (S16-01) ni la deuda del `<td colSpan>` de otros módulos.
- No se toca la visibilidad por rol del formulario (`!isMember`) — divergencia con
  `permisos-roles.md` anotada en BACKLOG, fuera de esta historia.

## Criterios de aceptación

1. **Dado** el formulario de movimiento abierto, **cuando** el usuario elige "Salida" y envía una
   cantidad menor o igual al stock de esa bodega, **entonces** el movimiento se inserta con
   `kind='out'`, el stock de esa bodega baja esa cantidad y el costo del movimiento queda igual al
   promedio ponderado vigente (no editable por el usuario).
2. **Dado** el formulario, **cuando** el usuario elige "Ajuste" e ingresa una cantidad negativa,
   **entonces** el movimiento se inserta con `kind='adjust'` y esa cantidad exacta (delta con
   signo), sin pedir costo unitario.
3. **Dado** el formulario, **cuando** el usuario elige "Ajuste" e ingresa una cantidad positiva,
   **entonces** se pide costo unitario y el movimiento se inserta con ese costo.
4. **Dado** una salida o un ajuste negativo cuya cantidad deja el stock de esa bodega por debajo de
   cero, **cuando** se envía el formulario, **entonces** no se inserta ningún movimiento y se
   muestra "No hay stock suficiente en esa bodega." inline junto al submit.
5. **Dado** el formulario abierto en viewport 375px, **cuando** se elige cualquier tipo de
   movimiento, **entonces** no hay scroll horizontal del body (`scrollWidth <= clientWidth + 1`).

## Modelo de datos y migraciones

N/A. Sin cambios de esquema — `stock_movements` y `register_movement` ya existen desde S2-03.

## Políticas RLS requeridas

N/A. Sin cambios; la RPC ya es `security definer` con su propia revalidación de tenant (auditada en
S2-03), y la tabla base sigue sin permitir insert directo desde el cliente.

## Funciones RPC e invariantes

Sin funciones nuevas. Se reutiliza `register_movement(p_product_id, p_warehouse_id, p_kind, p_qty,
p_unit_cost, p_ref_type, p_ref_id, p_note)`, invariantes ya vigentes:
- stock de la bodega no puede quedar negativo tras `out`/`adjust` negativo (`stock_insufficient`).
- costo de `out`/`adjust` negativo = promedio ponderado vigente, ignora `p_unit_cost` recibido.
- costo de `in`/`adjust` positivo = `p_unit_cost` recibido.

## Casos borde

- Cantidad = 0 en cualquier tipo → rechazado por Zod (`qty !== 0`), ya cubierto.
- Cambiar de "Salida" a "Entrada" tras haber escrito una cantidad negativa (imposible en salida por
  el `min`, pero si el usuario cambia de "Ajuste" negativo a "Entrada") → el campo cantidad debe
  quedar con `min="1"` de nuevo; un valor negativo remanente lo rechaza el Zod en servidor de
  cualquier forma (defensa en profundidad), aunque la UI debe evitarlo en lo posible.
- Ajuste con cantidad positiva pero sin costo ingresado → Zod `.default(0)` inserta costo 0
  (comportamiento ya vigente, no es nuevo de esta historia).

## Consideraciones de seguridad (docs/arch/seguridad.md)

- Boundary (`registerManualMovement`) ya valida con Zod antes de llamar la RPC; no cambia.
- Sin mass assignment: los argumentos de la RPC siguen nombrados uno a uno.
- La UI oculta el campo de costo por UX, no por seguridad — la RPC ignora `p_unit_cost` en
  salidas/ajustes negativos independientemente de lo que llegue, así que un cliente que fuerce el
  campo no puede alterar el costo congelado.
- Error de stock insuficiente sigue mapeado a mensaje genérico en español; el detalle (`error.code`)
  solo va al log del servidor.

## Plan de tests (qué test cubre qué criterio)

| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2, 3 | Vitest | `src/lib/validation/stock.test.ts` | `out` con qty negativa rechazado; `adjust` con qty negativa aceptado; `adjust` con qty positiva aceptado; qty 0 rechazado; `kind` inválido rechazado; `unit_cost` ausente → 0 |
| 4 | Vitest | `src/actions/stock.test.ts` | La acción reenvía `p_kind` recibido a la RPC; mapea `stock_insufficient` al mensaje nuevo ("No hay stock suficiente en esa bodega.") sin importar el `kind` |
| 1, 2, 3 | Playwright | `e2e/core-flow.spec.ts` | Tras la entrada existente: registrar una salida baja el stock mostrado; en "Salida" el campo Costo no está en el DOM |
| 5 | Manual (Playwright ad-hoc, ver plan de verificación) | — | `scrollWidth <= clientWidth+1` a 375px con el formulario abierto en cada tipo |

pgTAP: N/A — `supabase/tests/S2-03-stock-movements.sql` ya cubre `out`/`adjust` y la invariante de
stock ≥ 0 en `register_movement`; esta historia no toca `supabase/`.

## Historial
- 2026-08-15 · creada (draft)
- 2026-08-15 · aprobada por el humano (approved)
- 2026-08-15 · implementada, movida a specs/done/ (implemented)
