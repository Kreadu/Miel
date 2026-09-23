---
id: S14-05
titulo: Entender "Abrir caja" para operarla con confianza
estado: implemented      # draft → approved → implemented
depende_de: [S5-08]
---

# S14-05 — Entender "Abrir caja" para operarla con confianza

## Contexto y valor
`/ventas/caja` presenta dos formularios mudos: "Monto base de caja" al abrir y "Monto contado al
cierre" al cerrar, sin explicar qué son ni qué pasa después. El dueño de PYME no sabe si el monto
base es dinero que entrega o algo contable, ni qué significa la columna "Diferencia" de la tabla
de turnos. Mecánica real (`close_cash_session`,
`supabase/migrations/20260720202917_cash_sessions.sql:155-190`): al cerrar,
`esperado = monto base + pagos en efectivo del turno`, `diferencia = contado − esperado`.

## Alcance
- Encabezado de `/ventas/caja` gana una línea explicando el propósito de la sección (patrón de
  S11-05 en `/ventas`, `/compras`, `/inventario`, `/gastos`).
- `OpenSessionForm`: ayuda bajo "Monto base de caja".
- `CloseSessionForm`: ayuda bajo "Monto contado al cierre", explica la comparación contra lo
  esperado.
- Vista de sesión abierta (`page.tsx`): línea que anticipa qué pasará al cerrar.
- Tono cotidiano, sin jerga contable ("base", "arqueo", "descuadre").

## NO-alcance (explícito)
- No se calcula ni muestra el monto esperado antes de cerrar (se preserva el arqueo a ciegas).
- Sin cambios en `open_cash_session`/`close_cash_session`, validaciones ni RLS.
- Sin `Tooltip` (el proyecto no tiene esa primitiva; S11-05 ya decidió texto en página).
- Sin rediseño de la tabla de turnos.

## Criterios de aceptación
1. **Dado** `/ventas/caja` sin sesión abierta **cuando** se renderiza **entonces** el encabezado
   y el campo "Monto base de caja" tienen texto de ayuda visible, sin jerga contable.
2. **Dado** una sesión de caja abierta **cuando** se renderiza `/ventas/caja` **entonces** el
   campo "Monto contado al cierre" tiene texto de ayuda que explica que se compara contra lo
   esperado (base + ventas en efectivo del turno).
3. **Dado** viewport 375px **cuando** se renderiza `/ventas/caja` con los textos nuevos
   **entonces** no hay scroll horizontal del body.
4. **Dado** modo claro y modo oscuro **cuando** se renderizan los textos de ayuda **entonces**
   usan `text-muted-foreground` (token existente, contraste ya validado en el sistema).

## Modelo de datos y migraciones
N/A — sin cambios de esquema.

## Políticas RLS requeridas
N/A.

## Funciones RPC e invariantes
N/A — sin cambios en `open_cash_session`/`close_cash_session`.

## Casos borde
- Sesión sin pagos en efectivo aún: el texto no promete un número, solo explica el mecanismo.

## Consideraciones de seguridad (docs/arch/seguridad.md)
N/A — texto estático, sin boundary de servidor ni dato de usuario nuevo en pantalla.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | Vitest | src/app/(app)/ventas/caja/open-session-form.test.tsx | Label + texto de ayuda del monto base visibles |
| 2 | Vitest | src/app/(app)/ventas/caja/close-session-form.test.tsx | Label + texto de ayuda del monto contado visibles |
| 1, 3 | E2E | e2e/core-flow.spec.ts | Ayuda del monto base visible en el flujo real de apertura |
| 3, 4 | Manual | — | 375px sin overflow, claro y oscuro |

## Historial
- 2026-08-16 · creada y aprobada por el humano vía plan mode (approved)
- 2026-08-16 · implementada (textos de ayuda en apertura/cierre/encabezado), verificada
  end-to-end (implemented)
