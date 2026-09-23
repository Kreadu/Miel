---
id: S14-03
titulo: Logo/nombre "Miel" como link a Inicio
estado: implemented      # draft → approved → implemented
depende_de: [S1-04]
---

# S14-03 — Logo/nombre "Miel" como link a Inicio

## Contexto y valor
Convención web universal: el logo lleva al home. Hoy el bloque de marca (`Logo` + texto "Miel")
en `src/app/(app)/layout.tsx` es decorativo, en dos sitios (sidebar de escritorio y header
móvil). Para volver a "Inicio" desde cualquier pantalla el usuario debe buscar el ítem del menú.
La landing (`site-header.tsx`) ya usa este patrón apuntando a `/`; se replica dentro de la app
apuntando a `/inicio`.

## Alcance
- Componente `src/app/(app)/brand-link.tsx` (server component): `Logo` + texto "Miel" envueltos
  en `<Link href="/inicio">`, mismo tamaño/tipografía que hoy.
- Usado en los dos sitios de `src/app/(app)/layout.tsx` (sidebar de escritorio y header móvil,
  incluido dentro del drawer/`Sheet`).

## NO-alcance (explícito)
- `(auth)/layout.tsx`, `/onboarding`, `/invite/[token]`: logo sigue decorativo (sin sesión o sin
  tenant activo, `/inicio` no es destino válido).
- Cierre automático del `Sheet` móvil al navegar (deuda preexistente, no introducida ni corregida
  aquí; anotada en BACKLOG).
- `TenantSwitcher`, nombre del tenant, rol: sin cambios.

## Criterios de aceptación
1. **Dado** cualquier pantalla autenticada en escritorio (≥768px) **cuando** el usuario hace clic
   en el logo/"Miel" del sidebar **entonces** navega a `/inicio`.
2. **Dado** cualquier pantalla autenticada en móvil (<768px, header visible) **cuando** el usuario
   hace clic en el logo/"Miel" del header **entonces** navega a `/inicio`.
3. **Dado** el drawer móvil abierto **cuando** el usuario hace clic en el logo/"Miel" dentro del
   drawer **entonces** navega a `/inicio` (el drawer puede quedar abierto tras la navegación,
   comportamiento ya existente para el resto de los ítems del menú).
4. **Dado** el link de marca enfocado por teclado (Tab) **entonces** muestra el anillo de foco del
   sistema (`focus-visible`), sin `outline-none` sin reemplazo.
5. **Dado** viewport 375px **cuando** se renderiza el header o el drawer con el link de marca
   **entonces** no hay scroll horizontal del body (`scrollWidth === clientWidth`).

## Modelo de datos y migraciones
N/A — sin cambios de esquema.

## Políticas RLS requeridas
N/A — sin tablas nuevas ni acceso a datos.

## Funciones RPC e invariantes
N/A — sin lógica transaccional.

## Casos borde
- El link de marca no debe interceptar el toggle del `Sheet` (son elementos distintos en el DOM,
  sin anidamiento).
- Usuario ya en `/inicio`: clic en el logo no debe romper (Next.js navega a la misma ruta sin
  error).

## Consideraciones de seguridad (docs/arch/seguridad.md)
`href="/inicio"` es una ruta interna estática, no derivada de input del usuario — sin riesgo de
open redirect. Sin boundary de servidor nuevo (no hay Server Action ni RPC). N/A el resto del
checklist (no aplica autenticación/autorización nueva: el layout ya exige sesión y tenant activo
antes de renderizar el link).

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2, 3 | Vitest | src/app/(app)/brand-link.test.tsx | `<BrandLink />` renderiza un link con nombre accesible "Miel" y `href="/inicio"` |
| 1 | E2E | e2e/core-flow.spec.ts | Clic en el logo del `aside` (escritorio) navega a `/inicio` |
| 4, 5 | Manual | — | Verificación visual: foco por teclado, 375px sin overflow, claro/oscuro |

## Historial
- 2026-08-15 · creada (draft)
- 2026-08-15 · aprobada por el humano (approved)
- 2026-08-16 · implementada (`brand-link.tsx` + integración en `layout.tsx`), verificada
  end-to-end (implemented)
