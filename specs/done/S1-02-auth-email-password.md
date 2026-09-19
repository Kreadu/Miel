---
id: S1-02
titulo: Autenticación email+password
estado: implemented
depende_de: [S1-01]
---

# S1-02 — Autenticación email+password

## Contexto y valor
Nadie puede usar el ERP sin identidad. Esta historia entrega el ciclo completo de sesión
(registro, entrada, salida, recuperación) sobre Supabase Auth, con la sesión disponible en
Server Components vía `@supabase/ssr`. Es la puerta de entrada a todo lo demás.

## Alcance
- Páginas públicas: `/signup`, `/login`, `/forgot-password`, `/reset-password` (grupo `(auth)`).
- Server Actions con validación Zod: signup, login, logout, solicitar recuperación, fijar
  contraseña nueva. Errores de Supabase traducidos a mensajes en español.
- Clientes Supabase server/browser y middleware de refresco de sesión según skill `nextjs-miel`.
- Redirecciones: autenticado que visita `(auth)` → a la app; anónimo que visita `(app)` → `/login`.
- Headers de seguridad en `next.config.ts` (CSP, `frame-ancestors 'none'`,
  `Referrer-Policy`, `X-Content-Type-Options: nosniff`) — el estándar `arch/seguridad.md`
  los asigna a esta historia por ser el primer código con sesión.
- UI con `miel-design` (4 estados obligatorios: loading, error, éxito, default).
- Página placeholder mínima `/onboarding` (stub) como destino de redirect post-auth
  mientras S1-03 no exista; S1-03 la reemplaza por el flujo real de creación de empresa.
  El grupo `(app)` real llega en S1-04 — hasta entonces la protección de rutas se limita a
  lo que S1-02 introduce.
- Route handler de callback que intercambia el código de sesión
  (`exchangeCodeForSession` de `@supabase/ssr`, p. ej. `/auth/callback` o integrado en
  `/reset-password`), necesario para completar el enlace de recuperación (criterio 4).
- Config de Supabase: `[auth.email] enable_confirmations = false` en
  `supabase/config.toml` — el signup deja al usuario autenticado de inmediato; la
  verificación de email obligatoria queda en Fase 2 (ver NO-alcance).

## NO-alcance (explícito)
- Crear tenant/onboarding (S1-03). Layout de la app (S1-04). Invitaciones (S1-05).
- OAuth/social login, MFA, verificación de email obligatoria (Fase 2).
- e2e Playwright (queda para S9-01).

## Criterios de aceptación
1. **Dado** un visitante anónimo **cuando** se registra con email y contraseña válidos (≥8
   caracteres) **entonces** queda autenticado sin confirmación de correo y es redirigido al
   stub `/onboarding` (S1-03 lo reemplaza por el flujo real de creación de empresa).
2. **Dado** un usuario registrado **cuando** inicia sesión con credenciales correctas
   **entonces** entra a la app; con credenciales incorrectas **entonces** ve un error claro
   en español sin revelar si el email existe.
3. **Dado** un usuario autenticado **cuando** cierra sesión **entonces** la sesión se invalida
   y las rutas `(app)` lo redirigen a `/login`.
4. **Dado** un usuario que olvidó su contraseña **cuando** solicita recuperación y sigue el
   enlace del correo **entonces** puede fijar una contraseña nueva y entrar con ella.
5. **Dado** cualquier Server Action de auth **cuando** recibe entrada inválida (email
   malformado, contraseña corta) **entonces** responde `{ ok: false, error }` desde el schema
   Zod, sin llamar a Supabase.

## Modelo de datos y migraciones
N/A — usa `auth.users` (gestionada por Supabase). Sin migraciones propias.

## Políticas RLS requeridas
N/A — no hay tablas de negocio nuevas. Ver matriz `docs/arch/permisos-roles.md` (no aplica
a auth).

## Funciones RPC e invariantes
N/A — Supabase Auth provee las operaciones; las Server Actions solo validan forma y llaman.

## Casos borde
- Email ya registrado en signup → mensaje genérico (sin enumeración de usuarios).
- Token de recuperación vencido o ya usado → error claro y opción de reenviar.
- Sesión expirada a mitad de uso → middleware refresca; si no puede, redirige a `/login`
  conservando `next=` para volver tras entrar.
- `next=` con URL absoluta, `//externo` o esquema no-http (`javascript:`) → se descarta y
  se redirige a la ruta por defecto de la app (anti open redirect).
- Doble submit del formulario → la action es idempotente para el usuario (estado pending
  deshabilita el botón).
- Enlace de recuperación con código inválido, ausente o ya consumido en el route handler de
  callback → error claro y opción de reenviar (mismo tratamiento que token vencido).

## Consideraciones de seguridad (docs/arch/seguridad.md)
- **Open redirect**: `next=` solo se honra si es ruta relativa interna (empieza con `/`,
  no con `//`, sin esquema); validador único reutilizable, testeado en Vitest.
- **Headers**: CSP, frame-ancestors, Referrer-Policy y nosniff activos desde esta historia
  (ver Alcance); se auditan en S9-04.
- **Errores genéricos**: los mensajes de Supabase Auth nunca llegan crudos al cliente;
  sin enumeración de usuarios en signup, login ni recuperación (criterios 2 y casos borde).
- **Rate limiting**: se apoya en los límites integrados de Supabase Auth (MVP).
- **Validación**: todo boundary con Zod antes de llamar a Supabase (criterio 5).

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 5 | Vitest | src/lib/validation/auth.test.ts | Schemas Zod: válidos pasan, inválidos fallan con mensaje |
| Seguridad | Vitest | src/lib/validation/safe-redirect.test.ts | validador de `next=`: rutas internas pasan; absolutas, `//` y esquemas raros se descartan |
| 1–4 | Manual guiado | — | Flujo completo en local (checklist en PR); e2e formal en S9-01 |

## Historial
- 2026-07-19 · creada (draft) en la auditoría integral pre-desarrollo — pendiente de aprobación humana.
- 2026-07-19 · ADR-020: sección "Consideraciones de seguridad" — headers de seguridad en
  alcance, validador anti open redirect de `next=` con su test, errores genéricos explícitos.
- 2026-07-19 · revisión pre-aprobación: incorporados stub `/onboarding` como destino de
  redirect post-auth, route handler de callback (`exchangeCodeForSession`) para el enlace
  de recuperación, y `enable_confirmations = false` en `supabase/config.toml`. Sigue en
  `draft` — pendiente de aprobación humana.
- 2026-07-19 · **aprobada por el humano en sesión** (draft → approved); arranca implementación TDD.
- 2026-07-19 · implementada (TDD; approved → implemented). Supuestos materializados:
  (a) en Next 16 el middleware es `src/proxy.ts` (convención renombrada);
  (b) `/reset-password` se trata como ruta protegida en el proxy y NO rebota a usuarios
  autenticados — el enlace de recuperación deja sesión activa y sin esa excepción el
  criterio 4 sería imposible; (c) `supabase/config.toml` necesitó además
  `additional_redirect_urls` con `http://localhost:3000/**` y `http://127.0.0.1:3000/**`
  (GoTrue rechazaba el `redirectTo` del callback y caía a `site_url`). Los 5 criterios y
  casos borde verificados en local con navegador real (script desechable, no commiteado).
