---
id: S18-01
titulo: Abrir caja sin salir de la pantalla de Vender
estado: implemented
depende_de: [S5-08]
---

# S18-01 — Abrir caja sin salir de la pantalla de Vender

## Contexto y valor

Primera historia de la Épica E18 ("Simplificar Ventas — vender rápido, para una persona sin
mucha capacitación previa"). El dueño identificó, mirando la app en vivo, que el flujo de venta
tiene demasiados saltos entre pantallas: al entrar a "Punto de Venta" sin caja abierta, hoy se
muestra una pantalla intermedia ("Turno de caja cerrado") con un botón "Ir a Caja" que manda a
`/ventas/caja`, una página distinta, donde recién ahí está el formulario real para abrir la caja.
Para alguien con poca práctica, sentía que "son dos botones que llevan al mismo lugar" y que hay
que ir "de lado a lado del programa" para poder vender. La caja y el punto de venta siguen siendo
conceptos distintos (efectivo del turno vs. la venta en sí, confirmado explorando la app en vivo
en esta misma sesión) pero no hace falta cambiar de página para el paso de abrir caja.

## Alcance

- `ventas/pos/page.tsx`: cuando no hay sesión de caja abierta, en vez de un cartel con un link a
  `/ventas/caja`, se renderiza ahí mismo el formulario real de apertura (`OpenSessionForm`,
  reusado tal cual de `ventas/caja/open-session-form.tsx`, sin duplicarlo).
- `actions/cash-sessions.ts`: `openCashSession` agrega `revalidatePath("/ventas/pos")` (además
  del `revalidatePath(CASH_PATH)` existente) para que, al abrir la caja desde `/ventas/pos`, esa
  misma página se actualice sola y muestre el Punto de Venta real sin recargar manualmente.

## NO-alcance (explícito)

- No se toca `/ventas/caja` (sigue existiendo tal cual, para cerrar turno y ver el historial de
  sesiones — eso no se duplica en `/ventas/pos`).
- No se agrega todavía el campo de "encargado" (selector de empleados) que pidió el dueño para
  apertura/cierre — queda para una historia siguiente de esta misma épica (E18), pendiente de
  definir el modelo de datos (relación con `memberships`).
- No se cambia la navegación de `/ventas` (los botones "Caja"/"Punto de Venta" del módulo raíz
  siguen como están; se evalúa en una historia futura de E18).
- No se toca Pedidos ni Clientes.

## Criterios de aceptación

1. **Dado** un usuario con sesión de caja cerrada **cuando** entra a `/ventas/pos` **entonces** ve
   el formulario de "Abrir caja" (monto base) en esa misma página, sin link a otra URL.
2. **Dado** ese mismo usuario **cuando** completa el monto base y confirma **entonces**, sin
   recargar manualmente ni navegar, la página pasa a mostrar el Punto de Venta real (productos,
   carrito).
3. **Dado** un usuario con sesión de caja ya abierta **cuando** entra a `/ventas/pos` **entonces**
   ve el Punto de Venta directo, sin el formulario de apertura (comportamiento sin cambios).

## Modelo de datos y migraciones

N/A — reusa `open_cash_session` RPC existente (S5-08), sin cambios de esquema.

## Políticas RLS requeridas

N/A — sin cambios (mismo RPC, mismas políticas de S5-08).

## Funciones RPC e invariantes

N/A — sin cambios en `open_cash_session`/`close_cash_session`.

## Casos borde

- Doble apertura (alguien abre caja en dos pestañas): ya cubierto por el invariante
  `cash_session_already_open` del RPC (S5-08), sin cambios.

## Consideraciones de seguridad (docs/arch/seguridad.md)

N/A — mismo formulario, mismo server action, mismas validaciones Zod; solo cambia dónde se
renderiza.

## Plan de tests (qué test cubre qué criterio)

| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 3 | manual (sin Playwright en este sandbox) | `ventas/pos/page.tsx` | verificado a mano vía `npm run dev` en esta sesión |
| 2 | manual (sin Playwright en este sandbox) | `ventas/pos/page.tsx` + `actions/cash-sessions.ts` | verificado a mano vía `npm run dev` en esta sesión |

## Historial

- 2026-09-28 · creada y aprobada por el humano en la misma sesión, tras explorar la app en vivo y
  confirmar que Punto de Venta y Caja son pantallas distintas pero el flujo de apertura tenía un
  salto de página innecesario.
