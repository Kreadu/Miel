---
topic: deploy-vercel-supabase-cloud
status: vigente
related: [arch/stack.md, arch/seguridad.md, DECISIONS.md]
---

# Deploy — Vercel + Supabase cloud

Runbook reproducible para llevar Miel de local a producción cloud (S9-03). Partiendo de cero:
sin proyecto Supabase cloud ni proyecto Vercel creados. Requiere: cuenta Supabase, cuenta Vercel,
repo en GitHub, Supabase CLI instalado y logueado localmente.

## 1. Crear el proyecto Supabase cloud

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
   - Región: la más cercana a los usuarios reales (latencia).
   - Contraseña de BD: generarla fuerte y **guardarla** en un gestor de secretos (no en el repo,
     no en texto plano) — se necesita para `supabase link` y no se puede recuperar después.
   - Plan: **Free** para el MVP/beta (ver checklist de pausa en la sección 5).
2. Esperar a que el proyecto termine de aprovisionar (unos minutos).

## 2. Aplicar las migraciones

Desde la raíz del repo, con el Supabase CLI ya logueado (`supabase login` si no se ha hecho):

```bash
supabase link --project-ref <project-ref>   # Settings → General → Reference ID
supabase migration list                      # verificar que no haya drift antes de aplicar
supabase db push                              # aplica las 31 migraciones locales al cloud
```

- Si `migration list` muestra migraciones remotas que no están en local (drift), **detenerse y
  entender por qué** antes de forzar — no se asume que el proyecto está realmente vacío.
- Verificar que el grant acotado de `service_role` (ADR-023) quedó aplicado: en el SQL Editor del
  dashboard, `\dp` sobre alguna tabla o revisar que la migración
  `20260721055444_grant_service_role_tenants.sql` aparezca en `supabase migration list` como
  aplicada.

## 3. Configurar Supabase Auth para el dominio de Vercel

**Antes** de probar login/signup en producción (si no, `resetPasswordForEmail` y la confirmación
de email redirigen a `localhost`):

1. Dashboard del proyecto → **Authentication → URL Configuration**.
2. **Site URL**: `https://<tu-proyecto>.vercel.app` (se obtiene en el paso 4).
3. **Redirect URLs**: agregar el mismo dominio (y `http://localhost:3000` si se sigue
   desarrollando en paralelo).

Como el dominio de Vercel solo se conoce tras el primer deploy (paso 4), este paso se completa
**después** de crear el proyecto Vercel — volver aquí antes de probar el criterio 3 de la spec.

**Confirmación de email (beta)**: por defecto Supabase exige confirmar el correo antes del primer
login, pero el signup de la app (S1-02) no avisa de este paso — un beta tester puede quedar
bloqueado sin saber la causa (deuda de UI anotada en `docs/BACKLOG.md`). Mientras dure el período
de beta: **Authentication → Providers → Email → desactivar "Confirm email"**. Reactivar antes de
abrir la app a producción real (y resolver primero la deuda de UI del aviso post-signup).

## 4. Crear el proyecto Vercel

1. [vercel.com/new](https://vercel.com/new) → importar el repo de GitHub. Framework Next.js se
   autodetecta (build command / output ya vienen del `package.json`).
2. **Environment Variables** (Production + Preview, ambos entornos):
   - `NEXT_PUBLIC_SUPABASE_URL` = URL del proyecto (Settings → API → Project URL).
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon/public key (Settings → API → Project API keys).
   - **No** agregar `SUPABASE_SERVICE_ROLE_KEY` — la app en `src/` no la usa (regla #3 de
     AGENTS.md); si se necesita para `npm run seed` contra cloud, se corre localmente con
     `.env.local`, nunca desde Vercel.
   - `RESEND_API_KEY` (S12-03) — habilita el correo de invitación (`/equipo`). Sin ella el
     flujo sigue funcionando vía el enlace copiable (fallback, ver spec S12-03).
3. Deploy. Al terminar, copiar el dominio `*.vercel.app` asignado y completar el paso 3.

## 5. Verificación post-deploy (real, no declarada)

Los criterios de aceptación de la spec `specs/S9-03-deploy-cloud.md` se confirman así:

```bash
# Criterio 2: app accesible
curl -sI https://<tu-proyecto>.vercel.app | head -1        # HTTP/2 200

# Criterio 4: headers de seguridad intactos (S9-04), sin duplicados
curl -sI https://<tu-proyecto>.vercel.app
```

Revisar en la salida de `curl`:
- `content-security-policy` presente, con `connect-src` apuntando a la URL del proyecto Supabase
  cloud (no `localhost` ni `127.0.0.1`).
- `strict-transport-security` presente **una sola vez** (si Vercel además inyecta el suyo,
  ver "Casos borde" más abajo).
- `permissions-policy`, `referrer-policy`, `x-content-type-options` presentes.

Criterio 3 (login real): crear/usar un usuario en el dominio de Vercel, confirmar que llega a
`/inicio` con sesión persistida (cookies `@supabase/ssr`).

## Casos borde

- **HSTS duplicado por Vercel**: si `curl -sI` muestra dos líneas `strict-transport-security`,
  retirar el header de `next.config.ts` (Vercel gestiona el suyo a nivel de edge) y documentar la
  decisión en un ADR nuevo en `docs/DECISIONS.md`. Solo actuar con la evidencia real del `curl`.
- **Proyecto Supabase pausado**: el free tier pausa automáticamente tras ~7 días sin actividad.
  Antes de cualquier demo a beta testers: dashboard → verificar que el proyecto esté `Active`; si
  está `Paused`, reactivar desde el dashboard (tarda unos minutos).
- **Seed de demo en cloud (opcional)**: para poblar el tenant "Miel Demo" en el proyecto cloud,
  apuntar `.env.local` a la URL/anon key/service_role del proyecto cloud y correr `npm run seed`
  localmente. No es parte de los criterios de aceptación de S9-03.

## Referencias
- `docs/arch/stack.md` — límites del free tier y costo proyectado post-validación.
- `docs/arch/seguridad.md` — estándar de headers (ADR-020, ADR-024).
- `docs/DECISIONS.md` — ADR-023 (grant de `service_role`).
