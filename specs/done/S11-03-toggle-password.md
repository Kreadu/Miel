---
id: S11-03
titulo: Toggle de visibilidad de contraseña (ojito)
estado: implemented
depende_de: [S1-02]
---

# S11-03 — Toggle de visibilidad de contraseña (ojito)

## Contexto y valor
Los formularios de login, registro y reset-password usan `<Input type="password">` plano, sin
forma de revelar lo escrito. En móvil y con contraseñas largas esto provoca errores de tipeo y
fricción en el alta de cuenta. Se agrega un botón ojo/ojo-tachado que alterna la visibilidad.

## Alcance
- Componente compartido `src/components/password-input.tsx` (envuelve `Input` +
  `Button` del design system, icono `Eye`/`EyeOff` de `lucide-react`).
- Uso en `login-form.tsx`, `signup-form.tsx`, `reset-password-form.tsx`.

## NO-alcance (explícito)
- Sin cambios de backend, validación (`src/lib/validation/auth.ts`) ni Server Actions.
- Sin cambio de altura de `Input`/`Button` (deuda técnica anotada en BACKLOG, no se resuelve aquí).
- Sin formulario de cambio de contraseña autenticado (no existe en el repo).

## Criterios de aceptación
1. **Dado** el campo de contraseña recién montado **cuando** se renderiza **entonces** el
   `<input>` tiene `type="password"`.
2. **Dado** el campo con `type="password"` **cuando** se hace click en el botón toggle
   **entonces** el `<input>` pasa a `type="text"`; un segundo click lo vuelve a `password`.
3. **Dado** cualquier estado del toggle **cuando** se consulta el botón **entonces** su nombre
   accesible es "Mostrar contraseña" u "Ocultar contraseña" según corresponda, y
   `aria-pressed` refleja el estado.
4. **Dado** el formulario **cuando** se hace click en el botón toggle **entonces** el
   formulario NO se envía (`type="button"`).
5. **Dado** props como `name`, `autoComplete`, `minLength`, `required` **cuando** se pasan al
   componente **entonces** llegan sin alterar al `<input>` interno (`name="password"` intacto
   para `formData.get("password")` en `src/actions/auth.ts`).

## Modelo de datos y migraciones
N/A — sin cambios de esquema.

## Políticas RLS requeridas
N/A.

## Funciones RPC e invariantes
N/A.

## Casos borde
- `className` extra pasado al componente se combina (`cn`) sin pisar el `pr-9` necesario para
  que el texto no quede debajo del ícono.
- Con `aria-invalid` (error de validación) el borde `destructive` del `Input` se sigue viendo.
- El botón no debe interferir con el selector `page.getByLabel("Contraseña")` de
  `e2e/responsive.spec.ts` — su `aria-label` debe ser un texto distinto ("Mostrar/Ocultar
  contraseña", nunca "Contraseña" a secas).

## Consideraciones de seguridad (docs/arch/seguridad.md)
Cambio puramente de UI cliente, sin boundary de servidor nuevo. No expone ni transmite el valor
de la contraseña de forma distinta a como ya viaja en el `<form>` nativo.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | Vitest | src/components/password-input.test.tsx | type inicial "password" |
| 2 | Vitest | src/components/password-input.test.tsx | toggle alterna type en 2 clicks |
| 3 | Vitest | src/components/password-input.test.tsx | aria-label y aria-pressed cambian |
| 4 | Vitest | src/components/password-input.test.tsx | botón es type="button" |
| 5 | Vitest | src/components/password-input.test.tsx | props reenviadas al input interno |
| Regresión | E2E | e2e/responsive.spec.ts, e2e/core-flow.spec.ts | getByLabel("Contraseña") y login siguen funcionando |

## Historial
- 2026-08-14 · creada y aprobada por el humano vía plan mode (mismo mecanismo que S11-01).
- 2026-08-14 · implementada. TDD real: `src/components/password-input.test.tsx` rojo confirmado
  (componente inexistente) antes de crear `src/components/password-input.tsx`; luego 5/5 verde.
  Sin `@testing-library/jest-dom` ni `user-event` (no estaban instalados; se usó `fireEvent` +
  aserciones nativas del DOM para no sumar dependencias nuevas sin ADR).
  `npm run lint` ✓, `npx tsc --noEmit` ✓, `npm test` 143/143 ✓ (suite completa sin regresión).
  `e2e/responsive.spec.ts`: 3/3 rutas públicas en verde; bloque autenticado sigue `fixme`
  (preexistente, sidebar sin colapso móvil — no relacionado a esta historia).
  **Bloqueo (resuelto 2026-08-15):** `e2e/core-flow.spec.ts` no se había podido correr en la
  sesión de implementación (Supabase local no levantado). Al correrlo el humano con Supabase
  arriba, falló con *strict mode violation*: `getByLabel("Contraseña")` resolvía a 2 elementos
  (el `<input>` y el botón toggle, cuyo `aria-label` "Mostrar/Ocultar contraseña" contiene la
  palabra "Contraseña" — riesgo que esta misma spec había anticipado en "Restricciones" pero
  la implementación no cubrió). Fix: `e2e/core-flow.spec.ts:16` y `e2e/responsive.spec.ts:37`
  pasan a `getByLabel("Contraseña", { exact: true })` — se corrigen los selectores, no el
  `aria-label` (degradarlo a solo "Mostrar" sería peor accesibilidad). Verificado
  2026-08-15: `npm run test:e2e` completo 9/9 ✓ (1 skip preexistente, sidebar móvil, ajeno);
  `npm run lint` ✓, `npx tsc --noEmit` ✓, `npm test` 148/148 ✓. Historia ahora sí
  completamente verificada end-to-end.
