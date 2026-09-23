---
id: S12-03
titulo: Invitación llega por correo (Resend)
estado: implemented
depende_de: [S1-05]
---

# S12-03 — Invitación llega por correo

## Contexto y valor
Hoy (S1-05) invitar genera un enlace copiable que el owner debe reenviar a mano por su
canal (WhatsApp, email manual) — fricción y riesgo de copiar mal el token. Esta historia
envía el correo automáticamente al crear la invitación, cerrando el flujo sin trabajo manual
del owner.

## Alcance
- **Dependencia nueva**: paquete `resend` (SDK oficial). ADR en `docs/DECISIONS.md`
  justificando la elección sobre SMTP genérico (decisión tomada con el humano: Resend da un
  boundary de servidor simple — una llamada HTTP desde la Server Action existente — sin
  acoplarse a `auth.email.smtp` de Supabase, que está pensado para los correos nativos de
  Auth, no para contenido de negocio como este).
- `RESEND_API_KEY` en `.env.local` (gitignored) y `.env.example` (placeholder vacío,
  comentado si no hay cuenta lista); documentado en `docs/deploy.md` como variable de entorno
  de Vercel (Production + Preview).
- `createInvitation` (`src/actions/invitations.ts`) envía el correo tras insertar la
  invitación, en la misma Server Action: asunto + cuerpo con el nombre del tenant, el rol
  asignado, el enlace `/invite/<token>` y un aviso explícito de que el invitado **debe
  registrarse con ese mismo correo** (ver Casos borde de S1-05: el email del JWT debe
  coincidir).
- Remitente sandbox de Resend (`onboarding@resend.dev`) para el MVP — sin dominio propio
  verificado todavía; anotado como supuesto (ver Historial), Fase 2 puede migrar a dominio
  verificado sin cambiar el resto del flujo.
- El link copiable (S1-05) **se conserva** como fallback visible en la UI de `/equipo`
  (además del email, por si el correo no llega o cae en spam) — no se retira nada del
  criterio 1 de S1-05.
- Fallo de envío de correo **no revierte** la creación de la invitación (ya quedó
  persistida y es válida vía el link copiable); se informa al owner en la UI que el correo
  no pudo enviarse, sin bloquear el flujo.

## NO-alcance (explícito)
- Dominio propio verificado en Resend / DNS (SPF, DKIM) — Fase 2.
- Reenvío manual de la invitación por correo (botón "reenviar email") — historia futura si
  se necesita.
- Plantillas de correo con diseño HTML rico — MVP en texto plano o HTML mínimo inline, sin
  sistema de templates.
- Webhooks de Resend (bounce, delivered, etc.) — fuera de alcance.

## Criterios de aceptación
1. **Dado** un owner/admin que crea una invitación con email y rol válidos **cuando** la
   Server Action se completa **entonces** además de mostrar el enlace copiable (S1-05), se
   envía un correo a ese email con el nombre del tenant, el rol y el enlace de invitación,
   y un aviso de que debe registrarse con ese mismo correo.
2. **Dado** un fallo del proveedor de correo (API key inválida, rate limit, red) **cuando**
   ocurre al crear la invitación **entonces** la invitación queda creada igual (no se revierte
   el insert) y la UI muestra el enlace copiable con un aviso de que el correo no se pudo
   enviar — sin exponer el error interno del proveedor.
3. **Dado** el módulo de envío **cuando** se llama con datos de invitación **entonces** el
   contenido del correo nunca incluye el token crudo fuera del enlace `/invite/<token>` (sin
   loguearlo, sin exponerlo en el asunto).

## Modelo de datos y migraciones
N/A — no se tocan tablas. Se reutiliza `invitations` de S1-05 (token, email, role,
tenant_id ya existentes).

## Políticas RLS requeridas
N/A — la Server Action ya corre autenticada bajo las políticas de S1-05 (solo owner/admin
insertan en `invitations`); el envío de correo ocurre después del insert, sin RLS propia.

## Funciones RPC e invariantes
N/A — no hay RPC nueva. El envío de correo es una llamada HTTP de servidor (Resend SDK)
dentro de la Server Action existente `createInvitation`, no lógica transaccional de BD (no
aplica la regla innegociable 2: no es movimiento de stock/pago).

## Casos borde
- Owner invita al mismo email dos veces (invitaciones vigentes duplicadas, ya permitido en
  S1-05) → se envía un correo por cada invitación creada; no hay deduplicación de envío.
- `RESEND_API_KEY` ausente en el entorno (p. ej. desarrollo local sin cuenta configurada) →
  mismo camino que criterio 2 (fallo controlado, invitación creada, aviso en UI, sin romper
  el flujo existente ni los tests que no dependen de la key).
- Email de invitación con formato válido pero dominio inexistente → Resend acepta la
  petición (entrega asíncrona); no se trata como error en el criterio 2, es éxito de envío
  desde la perspectiva de la app.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- **Secretos**: `RESEND_API_KEY` solo en `.env.local` / variables de entorno de Vercel
  (Production + Preview) — nunca en el bundle del cliente (el envío ocurre en la Server
  Action, código de servidor; no se usa `NEXT_PUBLIC_*`).
- **Errores**: el error real del SDK de Resend (código, mensaje del proveedor) se loguea en
  servidor (`console.error`) y nunca llega al cliente — mensaje genérico en español, mismo
  patrón que `createInvitation` ya usa para errores de Supabase.
- **Sin dato sensible en el correo más allá de lo ya público del enlace**: el token viaja
  igual que en el link copiable de S1-05 (ya evaluado ahí como secreto de un solo uso,
  expiración 7 días); el correo no añade superficie nueva de exposición del token.
- **Validación de entrada**: sin cambio — `invitationSchema` (Zod) ya valida email/rol antes
  del insert; el contenido del correo se arma solo con datos ya validados (nombre del
  tenant, rol, token), sin interpolar input crudo del formulario.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 3 | Vitest | src/lib/email/invitation-email.test.ts | función pura que arma asunto/cuerpo: incluye tenant, rol, enlace `/invite/<token>`, aviso de mismo correo; nunca el token fuera del enlace |
| 2 | Vitest | src/actions/invitations.test.ts | `createInvitation` con envío de correo mockeado en fallo: invitación sigue creada, `ok:true` con `link`, sin lanzar; error interno no viaja al cliente |
| 1 | Vitest | src/actions/invitations.test.ts | `createInvitation` con envío mockeado en éxito: se llama al cliente de Resend con `to`, `subject`, contenido esperado |

## Historial
- 2026-08-15 · creada (draft). Decisión tomada con el humano vía `AskUserQuestion`: Resend
  sobre SMTP genérico de `config.toml` (las dos alternativas que planteaba el criterio del
  BACKLOG) — Resend da un boundary de servidor más simple para contenido de negocio: no
  reescribe el flujo de invitaciones (token, RPC `accept_invitation`) para pasar por
  `auth.admin.inviteUserByEmail`, que crea el usuario directamente y no encaja con el modelo
  actual de invitaciones propias + aceptación explícita. Aprobada por el humano
  (draft → approved).
- 2026-08-15 · implementada (approved → implemented). TDD real: Vitest escrito primero y
  verificado en rojo (`Failed to resolve import "./invitation-email"`, `sendEmailMock` sin
  llamadas) antes de crear los módulos; verde después. Nuevos: `src/lib/email/
  invitation-email.ts` (`buildInvitationEmail` puro + `sendInvitationEmail`, nunca lanza —
  criterio 2) y sus 3 tests (`invitation-email.test.ts`); `src/actions/invitations.ts` llama
  `sendInvitationEmail` tras el insert dentro de un `try/catch` propio (defensa en
  profundidad aunque la función interna ya no lanza), con 2 tests nuevos en
  `invitations.test.ts` (éxito llama a Resend con `to`/tenant/rol/link; fallo no revierte la
  invitación ni expone el error interno). ADR-028 en `DECISIONS.md` documenta la elección de
  Resend sobre SMTP genérico. `.env.example` y `docs/deploy.md` documentan `RESEND_API_KEY`
  (opcional, sin key el flujo cae al enlace copiable). Verificado: lint ✓, `tsc --noEmit` ✓,
  Vitest 172/172 ✓ (suite completa, no solo la historia). Sin pgTAP/RLS/RPC nueva (N/A por
  diseño, ver secciones correspondientes). Spec movida a `specs/done/`. BACKLOG S12-03 →
  `done`.
