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

Respuestas al humano: concretas, sin verbosidad — regla completa en `AGENTS.md` → Comunicación.

**Nunca ejecutes `git commit` ni `git push`: el humano se encarga siempre.** Sugiere el mensaje de commit y detente ahí.
