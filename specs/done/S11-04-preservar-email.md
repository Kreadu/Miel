---
id: S11-04
titulo: Preservar el correo en los formularios de auth tras un error
estado: implemented
depende_de: [S1-02]
---

# S11-04 — Preservar el correo en los formularios de auth tras un error

## Contexto y valor
Cuando login/registro/forgot-password devuelven error, el formulario se vacía por completo
(campos no controlados con `useActionState`) y el usuario debe reescribir su correo además de
la contraseña. Se conserva el correo entre reintentos; la contraseña nunca se devuelve al
cliente (sin ganancia real de UX, sí riesgo de exponerla en el payload RSC).

## Alcance
- `src/actions/auth.ts`: `AuthState` (rama de error) agrega `email?: string`, poblado en
  `login`, `signup`, `requestPasswordReset` desde el `FormData` crudo (no desde `parsed.data`,
  para cubrir también el caso de fallo de validación Zod).
- `login-form.tsx`, `signup-form.tsx`, `forgot-password-form.tsx`: `defaultValue` del input de
  correo desde `state.email` cuando `state.ok === false`.

## NO-alcance (explícito)
- `reset-password-form.tsx` no se toca (no tiene campo de correo).
- La contraseña nunca se preserva ni se devuelve en `AuthState`.
- Sin cambios en `src/lib/validation/auth.ts` ni en los mensajes de error existentes.
- Sin persistencia entre navegaciones/recargas (solo dentro del mismo ciclo de submit fallido
  vía `useActionState`).

## Criterios de aceptación
1. **Dado** un login con contraseña incorrecta **cuando** falla `signInWithPassword`
   **entonces** el estado de error incluye `email` igual al enviado y el input de correo lo
   muestra tras el submit.
2. **Dado** un correo con formato inválido **cuando** falla la validación Zod (antes de llamar
   a Supabase) **entonces** el estado de error también incluye ese `email` crudo.
3. **Dado** cualquier estado de error de `login`/`signup`/`requestPasswordReset` **cuando** se
   inspecciona **entonces** no contiene la contraseña bajo ninguna clave.
4. **Dado** un `signup` con correo ya registrado **cuando** falla **entonces** el email se
   conserva en el formulario (mismo mecanismo que login).
5. **Dado** un `requestPasswordReset` fallido **cuando** se re-renderiza el formulario
   **entonces** el correo se conserva; el camino `ok:true` (mensaje neutro) no repuebla nada.

## Modelo de datos y migraciones
N/A.

## Políticas RLS requeridas
N/A.

## Funciones RPC e invariantes
N/A.

## Casos borde
- `formData.get("email")` puede ser `File | null` por la API de `FormData`; se normaliza a
  `string | undefined` antes de guardarlo en el estado.
- Login: el mensaje de error sigue siendo genérico ("Correo o contraseña incorrectos"); devolver
  el email no reintroduce enumeración de usuarios — es el mismo dato que el usuario acaba de
  enviar, no información nueva sobre si la cuenta existe.

## Consideraciones de seguridad (docs/arch/seguridad.md)
Se decide explícitamente NO devolver la contraseña al cliente en ningún camino de error, para no
incluirla en el payload de respuesta de la Server Action. El correo no es secreto y ya viaja de
regreso en el propio submit del usuario.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | Vitest | src/actions/auth.test.ts (o fallback de componente) | login inválido devuelve email |
| 2 | Vitest | src/actions/auth.test.ts (o fallback de componente) | email inválido (Zod) devuelve email crudo |
| 3 | Vitest | src/actions/auth.test.ts (o fallback de componente) | estado de error nunca incluye password |
| 4 | Vitest | src/actions/auth.test.ts (o fallback de componente) | signup con error conserva email |
| 5 | Vitest | src/actions/auth.test.ts (o fallback de componente) | requestPasswordReset conserva email en error, no en ok |
| Regresión | E2E | e2e/responsive.spec.ts, e2e/core-flow.spec.ts | getByLabel("Correo electrónico") y flujo de login/signup siguen funcionando |

## Historial
- 2026-08-14 · creada y aprobada por el humano vía plan mode (mismo mecanismo que S11-01/S11-03).
- 2026-08-14 · implementada. TDD real: `src/actions/auth.test.ts` — **primer test de Server
  Action del repo**; se comprobó que el módulo `"use server"` sí es importable en vitest
  (mock de `@/lib/supabase/server`, `next/navigation`, `next/headers`) sin necesitar el
  fallback de componente previsto en el plan. Rojo confirmado (4/5 fallaban por falta de
  `email`) antes de tocar `auth.ts`, luego 5/5 verde.
  `login`/`signup`/`requestPasswordReset` devuelven `email` (del `FormData` crudo, cubre
  también el camino de fallo de Zod) en la rama `ok:false`; la contraseña nunca viaja en
  `AuthState`. `defaultValue` en los 3 inputs de correo (`login-form`, `signup-form`,
  `forgot-password-form`); `reset-password-form` sin cambios (no tiene campo de correo).
  `npm run lint` ✓, `npx tsc --noEmit` ✓, `npm test` 148/148 ✓ (suite completa).
  `e2e/responsive.spec.ts`: 3/3 rutas públicas ✓; bloque autenticado sigue `fixme`
  (preexistente, no relacionado).
  **Bloqueo (resuelto 2026-08-15):** mismo bloqueo de Supabase que S11-03. Al correr el humano
  `npm run test:e2e`, la única falla fue la colisión de selector `getByLabel("Contraseña")`
  causada por el toggle de S11-03 (ver su Historial) — sin relación a esta historia. Tras el
  fix en `e2e/core-flow.spec.ts` y `e2e/responsive.spec.ts`, suite completa 9/9 ✓ (1 skip
  preexistente, ajeno). Historia verificada end-to-end.
