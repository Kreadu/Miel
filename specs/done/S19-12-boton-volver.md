---
id: S19-12
titulo: Botón "Volver" en todas las páginas
estado: implemented
depende_de: []
---

# S19-12 — Botón "Volver" en todas las páginas

## Contexto y valor

El dueño notó que ninguna página tenía forma de volver a la anterior sin usar la navegación del
sidebar o el botón atrás del navegador.

## Alcance

- `BackButton` (`src/app/(app)/back-button.tsx`, client, `router.back()`) agregado **una sola
  vez** en `src/app/(app)/layout.tsx`, arriba de `{children}` — aparece en todas las páginas bajo
  `(app)` sin tocar cada página individualmente.
- Oculto en `/inicio` (ya tiene su propia forma de "volver": el logo del sidebar, S14-03 — un
  botón "Volver" ahí no tendría a dónde ir con sentido).

## NO-alcance (explícito)

- No se agregó a `/login`, `/signup`, `/onboarding` (fuera del layout `(app)`).

## Criterios de aceptación

1. **Dado** cualquier página bajo `(app)` excepto `/inicio` **cuando** se mira **entonces** hay un
   botón "Volver" arriba del contenido.
2. **Dado** `/inicio` **cuando** se mira **entonces** no aparece el botón.

## Plan de tests

| Criterio | Tipo | Qué verifica |
|---|---|---|
| 1, 2 | manual (sin Playwright en este sandbox) | verificado a mano por el humano |

## Historial

- 2026-09-28 · pedido por el humano ("falta en todas las hojas un botón que diga volver o una
  flecha").
