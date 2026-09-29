# Miel — ERP SaaS multitenant

Puente de contexto para agentes. **Las reglas operativas viven en `AGENTS.md` — léelo primero y cúmplelo.**

Protocolo de arranque de sesión (orden estricto, no leer más de lo necesario):
1. `AGENTS.md` — reglas innegociables y protocolo completo.
2. `docs/INDEX.md` — manifiesto de la wiki; desde ahí carga SOLO las páginas que tu historia necesita.
3. `docs/SESSION_LOG.md` — estado dejado por la sesión anterior.
4. La historia activa en `docs/BACKLOG.md` y su spec en `specs/`.

Si vas a tocar código en `src/`, aplica los skills de proyecto `nextjs-miel` (`.claude/skills/nextjs-miel/SKILL.md`)
y `ponytail` en intensidad `full` (`.claude/skills/ponytail/SKILL.md`).
Si el cambio incluye UI, aplica además `miel-design` (`.claude/skills/miel-design/SKILL.md`).
Si vas a tocar `supabase/` (migraciones, RPCs, pgTAP), aplica `supabase-miel` (`.claude/skills/supabase-miel/SKILL.md`).

**Cómo trabaja el humano hoy (2026-09-28, revisar si sigue vigente):** por defecto, `npm run dev`
local contra el Supabase cloud del proyecto (`https://seqdrtjdnfnqvztgpdys.supabase.co`), vía
`.env.local` (gitignored). El humano no tiene cuenta de Vercel — `https://miel-eight.vercel.app/`
quedó de un deploy manual de una sesión anterior, sin integración Git (`gh api
repos/Kreadu/Miel/commits/<sha>/check-runs` no muestra ningún check de Vercel, solo GitHub
Actions/Pages), no se actualiza con los pushes, y probablemente apunta a otro proyecto de
Supabase — varias cuentas nuevas fallaron ahí con "Correo o contraseña incorrectos" incluso recién
creadas. No asumas que esa URL sirve para nada hasta que se reconecte Vercel bien (pendiente,
pospuesto por el humano por cansancio, ver `docs/SESSION_LOG.md` sesión 2026-09-28). Si necesitás
levantar el server: `npm run dev`, el humano abre `http://localhost:3000` en su propio navegador
(este entorno corre en su misma compu).

Respuestas al humano: concretas, sin verbosidad — regla completa en `AGENTS.md` → Comunicación.

**Nunca ejecutes `git commit` ni `git push`: el humano se encarga siempre.** Sugiere el mensaje de commit y detente ahí.
