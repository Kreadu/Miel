---
id: S26-09
titulo: Orden de compra más rápida — Crear y enviar / Aprobar y enviar
estado: implemented
depende_de: [S26-02, S26-03, S26-08]
---

# S26-09 — Orden de compra en menos pasos

## Contexto y valor
El humano encontró el flujo de aprobación lento. Hoy son 4 pasos: crear borrador, "Aprobar",
"Marcar como ordenada" y "Recibir". Con esta historia, el flujo normal del dueño es
**Crear y enviar → Recibir**.

## Decisiones (aprobadas por el humano el 2026-10-08)
1. **Dueño o aprobador:** su botón principal es "Crear y enviar" (nace aprobada, firmada y
   ordenada) y "Guardar borrador" queda como opción secundaria.
2. **Orden en borrador** (pendiente, o borrador del propio aprobador): el aprobador ve un solo
   botón, "Aprobar y enviar", que aprueba y ordena en un paso (`approve_purchase`). Desaparecen
   el estado "Aprobada" y el botón "Marcar como ordenada".
3. **Quien no aprueba:** su botón es "Pedir aprobación".
4. **Editar:**
   - si edita un aprobador, la orden conserva su estado (una enviada sigue enviada);
   - si edita otra persona, vuelve a pendiente.

## Criterios de aceptación
1. El aprobador crea una orden enviada en un clic.
2. "Aprobar y enviar" deja la orden en `ordered`, con las firmas de aprobada y de enviada.
3. Quien no aprueba no puede aprobar.
4. Si un aprobador edita una orden enviada, sigue enviada; si la edita otra persona, vuelve a
   pendiente.

## Plan de tests
- pgTAP: `supabase/tests/S26-09-aprobar-y-enviar.sql`.
- Se adaptó `S26-02` (aprobar ahora deja la orden enviada).
- Vitest: `purchaseStatusKey`.

## Historial
- 2026-10-08 · approved por el humano ("si") e implemented. Los pgTAP de S26-09 se escribieron
  antes que la migración, pero se corrieron por primera vez ya con ella (no se vio el rojo). Solo
  en PGlite.
- `mark_purchase_ordered` queda en la BD sin uso desde la UI.
