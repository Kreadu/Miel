---
id: S26-07
titulo: Mi empresa en modo lectura con "Editar"
estado: implemented
depende_de: [S26-01, S27-01, S27-03]
---

# S26-07 — Mi empresa en modo lectura

## Contexto y valor
Pedido del humano (2026-10-07): en Mi empresa los formularios quedaban siempre editables con
"Guardar". Deben mostrarse en modo lectura con "Editar"; al pulsarlo, "Guardar" y "Cancelar".
Mismo patrón que la bodega principal (S19-38).

## Alcance
- Datos de la empresa, Tienda en línea y Formas de pago: campos deshabilitados hasta "Editar";
  "Guardar" vuelve a lectura con "Guardado."; "Cancelar" descarta los cambios.
- Pieza compartida `src/components/edit-mode.tsx` (`useEditMode` + `EditActions`), textos en
  `common.edit/save/saving/saved/cancel` (es/en/fr).
- "Abrir tienda" y "Copiar enlace" siguen disponibles en modo lectura.

## Criterios de aceptación
1. Al entrar a Mi empresa los tres bloques se ven en lectura con "Editar".
2. "Editar" → cambiar → "Guardar" guarda y vuelve a lectura; "Cancelar" restaura lo guardado.
3. Un error al guardar deja el bloque en edición con el mensaje.

## Plan de tests
Sin lógica de negocio nueva: lint, tsc, `npm test`; revisión visual del humano.

## Historial
- 2026-10-07 · creada, aprobada (pedido explícito del humano) e implementada.
