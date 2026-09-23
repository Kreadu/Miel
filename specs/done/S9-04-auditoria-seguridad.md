---
id: S9-04
titulo: Auditoría de seguridad pre-beta
estado: implemented      # draft → approved → implemented
depende_de: [S9-01]
---

# S9-04 — Auditoría de seguridad pre-beta

## Contexto y valor
Antes de invitar beta testers (S9-03, deploy en Vercel + Supabase cloud) necesitamos confirmar
que el código real cumple el estándar de seguridad `docs/arch/seguridad.md` (ADR-020), no solo
que las historias que lo tocaron lo declararon en su momento. Es una auditoría, no una
reescritura: `next.config.ts`, los boundaries de `src/actions/`, `safe-redirect.ts` y el CI ya
implementan la mayoría del estándar. Esta historia verifica cada control con evidencia,
cierra las brechas reales encontradas y deja el veredicto documentado para poder desplegar con
confianza.

## Alcance
- Verificar y dejar evidencia (con ruta/línea) de cada punto del checklist de
  `docs/arch/seguridad.md` sección A (headers, Zod en boundaries, XSS, open redirect, errores
  genéricos, `service_role` fuera de `src/`, gates de CI de `npm audit`/gitleaks).
- Cerrar brecha real: añadir `Strict-Transport-Security` y `Permissions-Policy` a los headers
  de `next.config.ts` (actualmente ausentes).
- Documentar con un ADR nuevo en `docs/DECISIONS.md` la decisión de mantener `'unsafe-inline'`
  en `script-src` del CSP para el MVP (diferir migración a nonces a Fase 2), reemplazando la
  referencia "se audita en S9-04" del comentario de `next.config.ts` por el ADR.
  Nota: los criterios de aceptación tratan `'unsafe-inline'` como una brecha **documentada y
  aceptada**, no como un fallo — el CSP sigue activo con el resto de directivas.
- Verificar `npm audit --omit=dev --audit-level=high` en limpio (o remediar dependencias si no
  lo está).
- Confirmar cobertura de `safe-redirect.test.ts` contra los vectores de open redirect del
  checklist (`//host`, `/\host`, esquema absoluto, protocolo relativo); ampliar si falta alguno.
- Prueba manual de open redirect documentada en el Historial (post-login con `next` malicioso).

## NO-alcance (explícito)
- Migrar el CSP a nonces por request (queda como deuda de Fase 2, con ADR justificando por qué).
- Rate limiting aplicativo fino por RPC (explícitamente diferido a Fase 2 en el propio estándar).
- Pentesting externo o herramientas de escaneo dinámico (DAST); esta auditoría es de código y
  configuración contra el estándar propio, no una auditoría externa contratada.
- Tocar `supabase/` (RLS, RPCs): ya cubierto por el test guardián de CI y las auditorías previas
  de cada historia; fuera de alcance salvo que esta auditoría encuentre una brecha ahí.
- Fix de observabilidad menor en `src/actions/pos.ts` (falta de `console.error` antes del
  mapeo de error) — se anota como deuda técnica en BACKLOG si no se resuelve aquí; no es un
  criterio de aceptación de esta historia.

## Criterios de aceptación (máx ~5; si necesitas más, parte la historia)
1. **Dado** el checklist de `docs/arch/seguridad.md` **cuando** se audita cada control contra
   el código real **entonces** cada punto queda marcado con evidencia (ruta + línea) en el
   Historial de esta spec, sin excepciones sin justificar.
2. **Dado** una respuesta HTTP de la app en runtime (`npm run build && npm start`)
   **cuando** se inspeccionan sus headers **entonces** incluye `Content-Security-Policy`,
   `Strict-Transport-Security`, `Permissions-Policy`, `Referrer-Policy` y
   `X-Content-Type-Options` con los valores definidos en `next.config.ts`.
3. **Dado** un intento de login con `?next=` apuntando a un host externo o protocolo-relativo
   (`//evil.com`, `/\evil.com`, `https://evil.com`) **cuando** se completa el login
   **entonces** la app redirige solo a una ruta interna (`/inicio` o similar), nunca al host
   externo — verificado por test automatizado y por prueba manual documentada.
4. **Dado** el uso de `'unsafe-inline'` en `script-src` del CSP **cuando** se audita
   **entonces** existe un ADR en `docs/DECISIONS.md` que justifica mantenerlo en el MVP y
   registra la migración a nonces como deuda de Fase 2.
5. **Dado** el estado de dependencias del proyecto **cuando** se ejecuta
   `npm audit --omit=dev --audit-level=high` **entonces** termina sin vulnerabilidades de
   severidad `high`/`critical` (o quedan remediadas antes de cerrar la historia).

## Modelo de datos y migraciones
N/A — no se tocan tablas, RLS ni RPCs.

## Políticas RLS requeridas
N/A

## Funciones RPC e invariantes
N/A

## Casos borde
- **Vectores de open redirect variados**: `//host` (protocolo-relativo), `/\host` (backslash,
  algunos navegadores lo normalizan a `//`), URL absoluta con esquema (`https://`, `javascript:`),
  string vacío o `null` — todos deben resolver a la ruta por defecto interna, nunca reflejar el
  input crudo. `safe-redirect.ts` ya cubre esto; el criterio 3 es de **verificación**, no de
  implementación nueva, salvo que se encuentre un vector no cubierto.
- **HSTS en desarrollo local (`http://localhost`)**: el header se envía igual (Next no lo
  condiciona por entorno como hace con `unsafe-eval`); no rompe `next dev`/`next start` en HTTP
  porque el navegador solo fuerza HTTPS en subsecuentes visitas al dominio real, no en
  `localhost`. Sin caso especial que manejar en código.
- **`npm audit` con hallazgos de severidad menor a `high`**: no bloquean el criterio 5 (el gate
  de CI ya usa `--audit-level=high`); se anotan en BACKLOG como deuda si aparecen, no se
  fuerza su remediación en esta historia.

## Consideraciones de seguridad (docs/arch/seguridad.md)
Esta historia ES la auditoría del estándar completo — todos los puntos de la sección A aplican
y se verifican uno a uno en el Historial. No introduce boundaries nuevos (sin Server Actions ni
RPCs nuevas), por lo que Zod/columnas explícitas no aplican como cambio, solo como verificación
de lo ya existente.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | Manual (documentado) | Historial de esta spec | Checklist completo auditado con evidencia. |
| 2 | Manual (`curl -I`) | Historial de esta spec | Los 5 headers presentes en runtime tras el build. |
| 3 | Vitest | src/lib/validation/safe-redirect.test.ts | `safeNext()` neutraliza los vectores de open redirect listados en Casos borde. |
| 3 | Manual | Historial de esta spec | Prueba end-to-end de login con `next` malicioso. |
| 4 | Documental | docs/DECISIONS.md (ADR nuevo) | ADR redactado y referenciado desde `next.config.ts`. |
| 5 | CLI | `npm audit --omit=dev --audit-level=high` | Salida sin vulnerabilidades high/critical. |

## Historial
- 2026-07-21 · creada (draft)
- 2026-07-21 · aprobada por el humano (approved).
- 2026-07-21 · implementada y auditoría completa (implemented):
  - **CA1 — checklist auditado con evidencia:**
    - CSP + Referrer-Policy + X-Content-Type-Options + `frame-ancestors 'none'`: activos antes
      de esta historia, `next.config.ts`.
    - Zod en todo boundary + columnas explícitas + sin spread del cliente: verificado en las 18
      Server Actions de `src/actions/` (patrón de referencia `customers.ts`, `sales.ts` vía RPC).
    - `service_role` jamás en `src/`: confirmado, `grep -rn "SERVICE_ROLE" src/` sin resultados;
      únicos clientes usan `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`src/lib/supabase/{server,client}.ts`).
    - Errores genéricos al cliente: confirmado en las actions auditadas (mapeo a mensajes en
      español, detalle solo en `console.error` del servidor).
    - Open redirect: mitigado por `safeNext()` (`src/lib/validation/safe-redirect.ts`), usado en
      los 4 call sites reales (`src/actions/auth.ts:32,49,93`,
      `src/app/auth/callback/route.ts:15`).
    - Gates de CI: `npm audit --omit=dev --audit-level=high` y `gitleaks/gitleaks-action@v2`
      confirmados activos en `.github/workflows/ci.yml:22,40-49`.
  - **CA2 — headers en runtime:** verificado con `npm run build` + `next start` real (puerto
    alterno para no interferir con el `next dev` del humano ya corriendo en :3000; NODE_ENV=production
    explícito). `curl -I` confirmó los 5 headers presentes, incluyendo los 2 nuevos
    (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` y
    `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`), y
    confirmó que en producción real `script-src` **no** incluye `'unsafe-eval'` (solo en dev).
    Cambio en `next.config.ts` (headers() array).
  - **CA3 — open redirect:** `safe-redirect.test.ts` ya cubría los 4 vectores del checklist
    (protocol-relative `//`, backslash `/\`, esquemas absolutos `https:`/`javascript:`/`data:`,
    vacío/null) — sin cambios necesarios, 21/21 aserciones en verde. Prueba manual complementaria:
    `GET /login?next=//evil.com` devuelve 200 sin fuga de redirect inmediata (el redirect real
    ocurre en el Server Action tras submit — `formData.get("next")` pasa siempre por
    `safeNext()` antes de `redirect()`, código inspeccionado línea a línea en los 4 call sites).
    No se fabricó un login E2E completo vía curl (requiere sesión real); la combinación
    test unitario + inspección de código se consideró evidencia suficiente (regla #9).
  - **CA4 — ADR de `'unsafe-inline'`:** ADR-024 añadido en `docs/DECISIONS.md`; comentario de
    `next.config.ts:3-5` actualizado para referenciarlo en vez de "se audita en S9-04".
  - **CA5 — `npm audit`:** `npm audit --omit=dev --audit-level=high` → **0 vulnerabilidades
    high/critical** (2 `moderate` preexistentes en `postcss` vía `next`, bajo el umbral del gate
    de CI; anotadas como deuda no bloqueante, no remediadas en esta historia por requerir
    downgrade breaking de `next`).
  - Verificación adicional (DoD): `npm run lint` ✓, `npx tsc --noEmit` ✓, `npm test` (Vitest)
    138/138 ✓, `npm run build` ✓ sin errores.
  - `docs/arch/seguridad.md` actualizado: sección de headers refleja HSTS/Permissions-Policy y
    referencia al ADR-024 en vez de "se audita en S9-04" (ya auditado).
  - Deuda anotada (no bloqueante, fuera de alcance de esta historia): `src/actions/pos.ts` no
    loguea `error.code` de la RPC antes de mapear a mensaje genérico (a diferencia del resto de
    actions) — pérdida de observabilidad menor, sin fuga de datos al cliente.
