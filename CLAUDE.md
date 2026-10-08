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

**Cómo trabaja el humano hoy (2026-09-30, revisar si sigue vigente):** `npm run dev` local
contra el Supabase cloud del proyecto (`https://seqdrtjdnfnqvztgpdys.supabase.co`), vía
`.env.local` (gitignored). **Vercel se descartó (ADR-041):** `https://miel-eight.vercel.app/` es un
despliegue viejo que no sirve y se da de baja; no lo uses ni propongas reconectarlo. Miel se
instalará en un servidor central por definir; la llave de la IA (`ANTHROPIC_API_KEY`) se configura
recién ahí. Si necesitás levantar el server: `npm run dev`, el humano abre `http://localhost:3000`
en su propio navegador (este entorno corre en su misma compu).

Respuestas al humano: concretas, sin verbosidad — regla completa en `AGENTS.md` → Comunicación.

**Al cerrar cada historia, haz `git commit` y `git push` a GitHub** (pedido del humano 2026-10-08), con el árbol
verificado y el mensaje convencional sugerido. Detalle en `AGENTS.md` → Git.
